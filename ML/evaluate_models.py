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
from sklearn.utils.class_weight import compute_sample_weight

from ML.utils import logger, CONFUSION_DIR
from ML.model_selector import MODELS_NEEDING_SAMPLE_WEIGHT


def evaluate_model(model, model_name, X_train, X_test, y_train, y_test, label_encoder):
    """
    Fit `model` on the training split, evaluate it on the test split, and
    return a dict with every metric required for the comparison report.

    Class imbalance: RandomForest/LightGBM get class_weight="balanced" in
    their constructor (ML/model_selector.py). XGBoost has no native
    multiclass class_weight, so a balanced sample_weight vector - computed
    from y_train only, never from test labels - is passed at fit() time
    instead for any model name listed in MODELS_NEEDING_SAMPLE_WEIGHT.
    """

    logger.info(f"Training model: {model_name}")

    fit_kwargs = {}
    if model_name in MODELS_NEEDING_SAMPLE_WEIGHT:
        fit_kwargs["sample_weight"] = compute_sample_weight("balanced", y_train)

    train_start = time.time()
    model.fit(X_train, y_train, **fit_kwargs)
    training_time = time.time() - train_start

    predict_start = time.time()
    y_pred = model.predict(X_test)
    prediction_time = time.time() - predict_start

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    macro_precision = precision_score(y_test, y_pred, average="macro", zero_division=0)
    macro_recall = recall_score(y_test, y_pred, average="macro", zero_division=0)
    macro_f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)

    roc_auc = _safe_roc_auc(model, X_test, y_test, model_name)

    report = classification_report(
        y_test, y_pred,
        target_names=[str(c) for c in label_encoder.classes_],
        output_dict=True,
        zero_division=0
    )
    matrix = confusion_matrix(y_test, y_pred)
    feature_importance = _safe_feature_importance(model, X_train, model_name)

    high_risk_recall = report.get("High", {}).get("recall", 0.0)
    extreme_risk_recall = report.get("Extreme", {}).get("recall", 0.0)

    logger.info(
        f"{model_name} evaluated: accuracy={accuracy:.4f}, macro_f1={macro_f1:.4f}, "
        f"high_recall={high_risk_recall:.4f}, extreme_recall={extreme_risk_recall:.4f}, "
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
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "high_risk_recall": high_risk_recall,
        "extreme_risk_recall": extreme_risk_recall,
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


def save_confusion_matrix(matrix, labels, model_name, output_dir=None):
    """Persist the confusion matrix both as a PNG heatmap and a raw CSV
    under `output_dir` (default: ML/reports/confusion_matrices/ -
    unchanged behaviour). ML/train_models.py passes a separate output_dir
    for the reliability-aware configuration so its confusion matrices
    never overwrite the baseline's."""

    output_dir = output_dir or CONFUSION_DIR
    os.makedirs(output_dir, exist_ok=True)
    safe_name = model_name.lower().replace(" ", "_")

    csv_path = os.path.join(output_dir, f"{safe_name}.csv")
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

    png_path = os.path.join(output_dir, f"{safe_name}.png")
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
            "Macro-F1": r["macro_f1"],
            "Macro Precision": r["macro_precision"],
            "Macro Recall": r["macro_recall"],
            "Weighted F1": r["f1_score"],
            "High Recall": r["high_risk_recall"],
            "Extreme Recall": r["extreme_risk_recall"],
            "ROC AUC": r["roc_auc"],
            "Training Time (s)": r["training_time"],
            "Prediction Time (s)": r["prediction_time"],
            "Selected": "Yes" if r["name"] == best_model_name else "No",
        }
        for r in results
    ])
