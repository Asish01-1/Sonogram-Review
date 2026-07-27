"""
Non-interactive inference script, called by the Node.js backend.

Usage:
    python3 predict.py <image_path> '<answers_json>'

<answers_json> is a JSON array of 10 booleans, one per clinical question,
in the same order as CLINICAL_QUESTIONS below.

Prints a single JSON object to stdout (and nothing else) so the Node
server can parse it directly.

*** DISCLAIMER ***
The clinical weights below are illustrative, not clinically validated.
This is a prototype/educational tool, not a diagnostic system.
"""

import sys
import json
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image


# --------------------------------------------------------------------------
# EDIT THESE
# --------------------------------------------------------------------------
CHECKPOINT_PATH = r"D:\Downloads\ultrasound-app\ultrasound-app\backend\models\best_dinov2_classifier.pt"
BACKBONE_NAME = "dinov2_vits14"
CLASS_NAMES = ["benign", "malignant", "normal"]
IMAGE_SIZE = 224

CLINICAL_QUESTIONS = [
    ("Age > 50 years?", 2),
    ("Family history of breast cancer?", 3),
    ("Breast lump present?", 1),
    ("Bloody nipple discharge?", 3),
    ("Skin dimpling?", 3),
    ("Lump increasing in size?", 2),
    ("Hard fixed lump?", 3),
    ("Swollen lymph nodes?", 3),
    ("Previous breast cancer?", 3),
    ("Unexplained weight loss?", 2),
]


class DinoV2Classifier(nn.Module):
    BACKBONE_DIMS = {
        "dinov2_vits14": 384,
        "dinov2_vitb14": 768,
        "dinov2_vitl14": 1024,
        "dinov2_vitg14": 1536,
    }

    def __init__(self, backbone_name="dinov2_vits14", num_classes=3, dropout=0.3):
        super().__init__()
        self.backbone = torch.hub.load("facebookresearch/dinov2", backbone_name)
        embed_dim = self.BACKBONE_DIMS[backbone_name]
        self.head = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Linear(embed_dim, 256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.head(self.backbone(x))


def load_model(device):
    model = DinoV2Classifier(BACKBONE_NAME, len(CLASS_NAMES)).to(device)
    state_dict = torch.load(CHECKPOINT_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def predict_image(model, image_path, device):
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]
    tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    image = Image.open(image_path).convert("RGB")
    tensor = tf(image).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        pred_idx = torch.argmax(probs).item()

    return CLASS_NAMES[pred_idx], probs[pred_idx].item(), probs.cpu().numpy().tolist()


def risk_level_from_score(score):
    if score >= 10:
        return "HIGH"
    elif score >= 5:
        return "MEDIUM"
    return "LOW"


def combine(ai_pred, ai_confidence, risk_level):
    ai_pct = ai_confidence * 100
    if risk_level == "HIGH":
        if ai_pred.lower() != "malignant":
            return "Malignant", min(99.0, ai_pct + 10)
        return ai_pred.capitalize(), min(99.0, ai_pct + 5)
    return ai_pred.capitalize(), ai_pct


def main():
    image_path = sys.argv[1]
    answers = json.loads(sys.argv[2])  # list of booleans, len == 10

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_model(device)

    ai_pred, ai_confidence, all_probs = predict_image(model, image_path, device)

    risk_score = 0
    reasons = []
    for (question, weight), answered_yes in zip(CLINICAL_QUESTIONS, answers):
        if answered_yes:
            risk_score += weight
            reasons.append(question)

    risk_level = risk_level_from_score(risk_score)
    final_pred, final_confidence = combine(ai_pred, ai_confidence, risk_level)

    result = {
        "aiPrediction": ai_pred.capitalize(),
        "aiConfidence": round(ai_confidence * 100, 2),
        "classProbabilities": {
            cls: round(p * 100, 2) for cls, p in zip(CLASS_NAMES, all_probs)
        },
        "riskScore": risk_score,
        "maxRiskScore": sum(w for _, w in CLINICAL_QUESTIONS),
        "riskLevel": risk_level,
        "finalPrediction": final_pred,
        "finalConfidence": round(final_confidence, 2),
        "reasons": reasons,
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
