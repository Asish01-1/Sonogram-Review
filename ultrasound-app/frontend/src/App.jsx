import React, { useState, useCallback, useRef } from "react";

const QUESTIONS = [
  "Age over 50 years?",
  "Family history of breast cancer?",
  "Breast lump present?",
  "Bloody nipple discharge?",
  "Skin dimpling?",
  "Lump increasing in size?",
  "Hard, fixed lump?",
  "Swollen lymph nodes?",
  "Previous breast cancer?",
  "Unexplained weight loss?",
];

const STEP = { UPLOAD: 0, QUESTIONS: 1, LOADING: 2, REPORT: 3 };

export default function App() {
  const [step, setStep] = useState(STEP.UPLOAD);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null));
  const [qIndex, setQIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, or BMP).");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const answerQuestion = (yes) => {
    const next = [...answers];
    next[qIndex] = yes;
    setAnswers(next);
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      submit(next);
    }
  };

  const goBackQuestion = () => {
    if (qIndex > 0) setQIndex(qIndex - 1);
  };

  const submit = async (finalAnswers) => {
    setStep(STEP.LOADING);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append(
        "answers",
        JSON.stringify(finalAnswers.map((a) => !!a))
      );

      const res = await fetch("/api/predict", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Prediction request failed");
      }

      const data = await res.json();
      setResult(data);
      setStep(STEP.REPORT);
    } catch (err) {
      setError(err.message);
      setStep(STEP.QUESTIONS);
    }
  };

  const restart = () => {
    setFile(null);
    setPreview(null);
    setAnswers(Array(QUESTIONS.length).fill(null));
    setQIndex(0);
    setResult(null);
    setError(null);
    setStep(STEP.UPLOAD);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__mark">
          <span className="topbar__pulse" aria-hidden="true" />
          Sonogram&nbsp;Review
        </div>
        <div className="topbar__meta">AI-assisted breast ultrasound triage</div>
      </header>

      <main className="stage">
        {step === STEP.UPLOAD && (
          <UploadScreen
            preview={preview}
            dragOver={dragOver}
            error={error}
            fileInputRef={fileInputRef}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onSelect={(e) => handleFile(e.target.files?.[0])}
            onContinue={() => setStep(STEP.QUESTIONS)}
          />
        )}

        {step === STEP.QUESTIONS && (
          <QuestionScreen
            question={QUESTIONS[qIndex]}
            index={qIndex}
            total={QUESTIONS.length}
            error={error}
            onAnswer={answerQuestion}
            onBack={goBackQuestion}
          />
        )}

        {step === STEP.LOADING && <LoadingScreen />}

        {step === STEP.REPORT && result && (
          <ReportScreen
            result={result}
            preview={preview}
            onRestart={restart}
          />
        )}
      </main>

      <footer className="disclaimer">
        This tool provides an illustrative risk estimate only and is not a
        validated diagnostic device. It does not replace evaluation by a
        qualified radiologist or physician. Always confirm results with a
        doctor.
      </footer>
    </div>
  );
}

function UploadScreen({
  preview,
  dragOver,
  error,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onSelect,
  onContinue,
}) {
  return (
    <section className="panel hero">
      <div className="hero__copy">
        <p className="eyebrow">Step 01 &mdash; Image</p>
        <h1>
          Bring a scan.
          <br />
          Leave with a report.
        </h1>
        <p className="hero__lede">
          Upload a breast ultrasound image. A DINOv2-based model reviews it
          alongside ten clinical questions to produce a single risk summary
          you can print and bring to your doctor.
        </p>
      </div>

      <div
        className={`scanner ${dragOver ? "scanner--drag" : ""} ${
          preview ? "scanner--filled" : ""
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="scanner__sweep" aria-hidden="true" />
        {preview ? (
          <img src={preview} alt="Uploaded ultrasound preview" className="scanner__img" />
        ) : (
          <div className="scanner__placeholder">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 6v20M11 17l9-9 9 9M8 30h24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>Drop image here, or</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onSelect}
          hidden
        />
        {preview && (
          <button
            type="button"
            className="scanner__replace"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace image
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className="btn btn--primary"
        disabled={!preview}
        onClick={onContinue}
      >
        Continue to questions
      </button>
    </section>
  );
}

function QuestionScreen({ question, index, total, error, onAnswer, onBack }) {
  const progress = ((index + 1) / total) * 100;
  return (
    <section className="panel question">
      <p className="eyebrow">Step 02 &mdash; Clinical history</p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="question__count">
        Question {index + 1} of {total}
      </p>
      <h2 className="question__text">{question}</h2>

      <div className="question__actions">
        <button className="btn btn--no" onClick={() => onAnswer(false)}>
          No
        </button>
        <button className="btn btn--yes" onClick={() => onAnswer(true)}>
          Yes
        </button>
      </div>

      {index > 0 && (
        <button className="link-btn" onClick={onBack}>
          &larr; Previous question
        </button>
      )}

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

function LoadingScreen() {
  return (
    <section className="panel loading">
      <div className="loading__dial" aria-hidden="true" />
      <p className="eyebrow">Step 03 &mdash; Analysis</p>
      <h2>Reading the scan.</h2>
      <p className="hero__lede">
        Running the image through the model and combining it with your
        answers.
      </p>
    </section>
  );
}

function ReportScreen({ result, preview, onRestart }) {
  const riskClass =
    result.riskLevel === "HIGH"
      ? "risk--high"
      : result.riskLevel === "MEDIUM"
      ? "risk--medium"
      : "risk--low";

  const finalIsConcerning = result.finalPrediction.toLowerCase() === "malignant";

  return (
    <section className="panel report" id="report-card">
      <div className="report__head">
        <div>
          <p className="eyebrow">Step 04 &mdash; Report</p>
          <h2>Combined screening summary</h2>
        </div>
        <p className="report__timestamp">
          {new Date().toLocaleString()}
        </p>
      </div>

      <div className="report__body">
        <div className="report__image">
          {preview && <img src={preview} alt="Reviewed ultrasound" />}
        </div>

        <div className="report__data">
          <DataRow label="AI prediction" value={result.aiPrediction} mono />
          <DataRow
            label="AI confidence"
            value={`${result.aiConfidence.toFixed(2)}%`}
            mono
          />

          <div className="prob-bars">
            {Object.entries(result.classProbabilities).map(([cls, pct]) => (
              <div className="prob-bar" key={cls}>
                <span className="prob-bar__label">{cls}</span>
                <div className="prob-bar__track">
                  <div
                    className="prob-bar__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="prob-bar__pct">{pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <DataRow
            label="Clinical risk score"
            value={`${result.riskScore} / ${result.maxRiskScore}`}
            mono
          />
          <DataRow
            label="Clinical risk level"
            value={<span className={`risk-badge ${riskClass}`}>{result.riskLevel}</span>}
          />

          <div className={`final-decision ${finalIsConcerning ? "final-decision--alert" : ""}`}>
            <p className="final-decision__label">Final prediction</p>
            <p className="final-decision__value">{result.finalPrediction}</p>
            <p className="final-decision__confidence">
              {result.finalConfidence.toFixed(2)}% confidence
            </p>
          </div>

          {result.reasons.length > 0 && (
            <div className="reasons">
              <p className="reasons__label">Contributing factors</p>
              <ul>
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="report__actions">
        <button className="btn btn--ghost" onClick={() => window.print()}>
          Print / save for your doctor
        </button>
        <button className="btn btn--primary" onClick={onRestart}>
          Start a new review
        </button>
      </div>
    </section>
  );
}

function DataRow({ label, value, mono }) {
  return (
    <div className="data-row">
      <span className="data-row__label">{label}</span>
      <span className={`data-row__value ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}
