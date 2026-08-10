"""
Registry of algorithms taking part in the model comparison, and the
logic that picks a winner from a set of evaluation results.

Adding a new algorithm (CatBoost, LSTM, GRU, ...) later only requires
adding one entry to MODEL_REGISTRY / MODEL_FILENAMES below - nothing
else in the pipeline needs to change.
"""

from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from ML.utils import logger

# Factories (not instances) so every training run starts from a fresh,
# unfitted model.
MODEL_REGISTRY = {
    "RandomForest": lambda: RandomForestClassifier(
        n_estimators=100,
        random_state=42
    ),
    "XGBoost": lambda: XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        eval_metric="mlogloss"
    ),
    "LightGBM": lambda: LGBMClassifier(
        n_estimators=100,
        learning_rate=0.1,
        random_state=42
    ),
}

# File name each model is saved under inside ML/models/.
MODEL_FILENAMES = {
    "RandomForest": "random_forest.pkl",
    "XGBoost": "xgboost.pkl",
    "LightGBM": "lightgbm.pkl",
}

DEFAULT_SELECTION_METRIC = "f1_score"

# Metrics eligible for --metric; higher is always better for all of them.
SELECTABLE_METRICS = (
    "accuracy",
    "precision",
    "recall",
    "f1_score",
    "roc_auc",
)


def get_model_registry():
    return MODEL_REGISTRY


def select_best_model(results, metric=DEFAULT_SELECTION_METRIC):
    """
    Pick the best result dict (as produced by evaluate_models.evaluate_model)
    according to `metric`. Falls back to f1_score, then accuracy, as
    tie-breakers so the choice is always deterministic.
    """

    if metric not in SELECTABLE_METRICS:
        raise ValueError(
            f"Unknown selection metric '{metric}'. "
            f"Choose one of: {', '.join(SELECTABLE_METRICS)}"
        )

    def sort_key(result):
        primary = result.get(metric)
        primary = primary if primary is not None else -1
        return (primary, result["f1_score"], result["accuracy"])

    best = max(results, key=sort_key)

    logger.info(
        f"Selected best model: {best['name']} "
        f"(selection metric='{metric}', value={best.get(metric)})"
    )

    return best
