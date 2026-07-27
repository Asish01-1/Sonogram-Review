// backend/server.js
// Express server: accepts an ultrasound image + clinical questionnaire
// answers, calls the Python inference script, returns the combined report.

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".bmp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpg, jpeg, png, bmp) are allowed"));
    }
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/predict", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  let answers;
  try {
    answers = JSON.parse(req.body.answers); // expects array of 10 booleans
    if (!Array.isArray(answers) || answers.length !== 10) {
      throw new Error("answers must be an array of 10 booleans");
    }
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: `Invalid answers payload: ${err.message}` });
  }

  const imagePath = req.file.path;
  const pythonScript = path.join(__dirname, "predict.py");

  // const py = spawn("python3", [pythonScript, imagePath, JSON.stringify(answers)]);
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const py = spawn(pythonCmd, [pythonScript, imagePath, JSON.stringify(answers)]);

  let stdout = "";
  let stderr = "";

  py.stdout.on("data", (data) => (stdout += data.toString()));
  py.stderr.on("data", (data) => (stderr += data.toString()));

  py.on("close", (code) => {
    // Clean up uploaded file regardless of outcome
    fs.unlink(imagePath, () => {});

    if (code !== 0) {
      console.error("Python inference failed:", stderr);
      return res.status(500).json({ error: "Inference failed", details: stderr });
    }

    try {
      const result = JSON.parse(stdout.trim());
      return res.json(result);
    } catch (err) {
      console.error("Failed to parse Python output:", stdout);
      return res.status(500).json({ error: "Failed to parse inference output" });
    }
  });
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
