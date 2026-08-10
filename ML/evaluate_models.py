"""
Evaluation utilities: fit/predict timing, the full metric set required
for model comparison, confusion-matrix persistence, and the comparison
table builder.
"""

import os
import time

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
    confusion_matrix
)

from ML.utils import logger, CONFUSION_DIR


def evaluate_model(model, model_name, X_train, X_test, y_train, y_test, label_encoder):
    """
    Fit `model` on the training split, evaluate it on the test split, and
    return a dict with every metric required for the comparison report.
    """

    logger.info(f"Training model: {model_name}")

    train_start = time.time()
    model.fit(X_train, y_train)
    training_time = time.time() - train_start

    predict_start = time.time()
    y_pred = model.predict(X_test)
    prediction_time = time.time() - predict_start

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    roc_auc = _safe_roc_auc(model, X_test, y_test, model_name)

    report = classification_report(
        y_test, y_pred,
        target_names=[str(c) for c in label_encoder.classes_],
        output_dict=True,
        zero_division=0
    )
    matrix = confusion_matrix(y_test, y_pred)
    feature_importance = _safe_feature_importance(model, X_train, model_name)

    logger.info(
        f"{model_name} evaluated: accuracy={accuracy:.4f}, f1={f1:.4f}, "
        f"roc_auc={roc_auc}, train_time={training_time:.4f}s, "
        f"predict_time={prediction_time:.4f}s"
    )

    return {
        "name": model_name,
        "model": model,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "roc_auc": roc_auc,
        "training_time": training_time,
        "prediction_time": prediction_time,
        "classification_report": report,
        "confusion_matrix": matrix,
        "labels": [str(c) for c in label_encoder.classes_],
        "feature_importance": feature_importance,
        "status": "Trained",
    }


def _safe_feature_importance(model, X_train, model_name):
    """Map the model's feature_importances_ to feature names, for the
    dashboard's Feature Importance chart. All three registered algorithms
    (RandomForest/XGBoost/LightGBM) expose this; gracefully returns an
    empty dict for any future algorithm that doesn't."""

    if not hasattr(model, "feature_importances_"):
        logger.warning(f"{model_name} has no feature_importances_ - skipping")
        return {}

    importances = [float(v) for v in model.feature_importances_]
    return dict(zip(list(X_train.columns), importances))


def _safe_roc_auc(model, X_test, y_test, model_name):
    """ROC-AUC only applies if the model can produce probabilities and
    every class shows up in the test split. Any failure is logged and
    treated as "not applicable" rather than crashing the run."""

    if not hasattr(model, "predict_proba"):
        logger.warning(f"{model_name} has no predict_proba - skipping ROC-AUC")
        return None

    try:
        y_proba = model.predict_proba(X_test)
        return roc_auc_score(
            y_test, y_proba,
            multi_class="ovr",
            average="weighted"
        )
    except Exception as exc:
        logger.warning(f"Could not compute ROC-AUC for {model_name}: {exc}")
        return None


def save_confusion_matrix(matrix, labels, model_name):
    """Persist the confusion matrix both as a PNG heatmap and a raw CSV
    under ML/reports/confusion_matrices/."""

    os.makedirs(CONFUSION_DIR, exist_ok=True)
    safe_name = model_name.lower().replace(" ", "_")

    csv_path = os.path.join(CONFUSION_DIR, f"{safe_name}.csv")
    pd.DataFrame(matrix, index=labels, columns=labels).to_csv(csv_path)

    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right")
    ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(f"Confusion Matrix - {model_name}")

    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(j, i, str(matrix[i, j]), ha="center", va="center")

    fig.colorbar(im, ax=ax)
    fig.tight_layout()

    png_path = os.path.join(CONFUSION_DIR, f"{safe_name}.png")
    fig.savefig(png_path)
    plt.close(fig)

    logger.info(f"Saved confusion matrix for {model_name} -> {png_path}")

    return png_path, csv_path


def build_comparison_table(results, best_model_name):
    """Build the model_comparison.csv DataFrame."""

    return pd.DataFrame([
        {
            "Model": r["name"],
            "Accuracy": r["accuracy"],
            "Precision": r["precision"],
            "Recall": r["recall"],
            "F1 Score": r["f1_score"],
            "ROC AUC": r["roc_auc"],
            "Training Time (s)": r["training_time"],
            "Prediction Time (s)": r["prediction_time"],
            "Selected": "Yes" if r["name"] == best_model_name else "No",
        }
        for r in results
    ])
