# Sonogram Review — AI-Assisted Ultrasound Screening
We are working on batch processing and a production level MLOPS app to implement in real health care 🚀.
Greetings from Asish.
Thank You For visiting my profile 😊.

A three-part app: React frontend, Node/Express backend, Python (PyTorch)
inference script that loads your already-trained DINOv2 checkpoint.

```
ultrasound-app/
  backend/
    server.js        # Express API: /api/predict
    predict.py        # Loads checkpoint, runs inference, prints JSON
    package.json
  frontend/
    src/App.jsx        # Upload -> Questionnaire -> Report flow
    src/App.css
    index.html
    package.json
```

## 1. Configure the Python inference script

Open `backend/predict.py` and edit the top constants:

```python
CHECKPOINT_PATH = "/absolute/path/to/best_dinov2_classifier.pt"
BACKBONE_NAME = "dinov2_vits14"          # match what you trained with
CLASS_NAMES = ["benign", "malignant", "normal"]   # match training's class order
```

Test it standalone first (before wiring up the servers):
```bash
cd backend
python3 predict.py /path/to/some_test_image.jpg "[true,false,true,false,true,true,true,false,false,false]"
```
It should print a single line of JSON. If it errors, fix that before moving on —
the web app will fail the same way the standalone script does.

## 2. Run the backend

```bash
cd backend
npm install
npm start
```
Runs on http://localhost:5000. Requires `python3`, `torch`, `torchvision`, and
`Pillow` to be installed and importable from wherever `npm start` is run.

## 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173 and proxies `/api/*` requests to the backend
(see `vite.config.js`).

Open http://localhost:5173 in your browser.

## 4. Production build (optional)

```bash
cd frontend
npm run build
```
Outputs static files to `frontend/dist/` — serve these with any static host
(or have Express serve them directly by adding
`app.use(express.static(path.join(__dirname, "../frontend/dist")))` to
`server.js`).

## Notes / limitations

- **Not a validated diagnostic tool.** The clinical risk weights in
  `predict.py` are illustrative, not derived from clinical studies. Treat
  this as a prototype for learning/demo purposes.
- **Cold start is slow.** Every request currently spawns a new Python
  process that reloads the DINOv2 backbone from scratch (`torch.hub.load`
  downloads/loads weights each call). For real usage, convert `predict.py`
  into a small persistent FastAPI/Flask service the Node server calls over
  HTTP instead of spawning a new process each time — much faster after the
  first request.
- **File size limit** is set to 10MB in `server.js` (`multer` config);
  adjust if needed.
- **CORS** is wide open (`cors()` with no options) for local development —
  restrict `origin` before deploying anywhere public.
