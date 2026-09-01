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
    # Hyperparameters selected by grid search on a validation split held out
    # from within the training period (inner-train 2010-2017, validation
    # 2018-2019), scored on validation macro-F1. Six candidate configurations
    # were compared per algorithm. The 2020-2023 test period was not consulted
    # at any point during selection; it was evaluated exactly once, after the
    # configuration below was fixed. Full search results are recorded in
    # ML/reports/hyperparameter_search.csv.
    "RandomForest": lambda: RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
        # Selected on validation macro-F1 0.5778, best of six candidates.
        max_depth=20,
        min_samples_leaf=2
    ),
    "XGBoost": lambda: XGBClassifier(
        n_estimators=100,
        # Selected on validation macro-F1 0.5085, best of six candidates.
        max_depth=5,
        min_child_weight=5,
        subsample=0.8,
        colsample_bytree=0.8,
        learning_rate=0.1,
        random_state=42,
        eval_metric="mlogloss"
        # No native multiclass class_weight - balanced sample_weight is
        # computed from y_train and passed at .fit() time instead, see
        # MODELS_NEEDING_SAMPLE_WEIGHT below and evaluate_models.py.
    ),
    "LightGBM": lambda: LGBMClassifier(
        n_estimators=100,
        # Selected on validation macro-F1 0.5175, best of six candidates.
        max_depth=10,
        min_child_samples=30,
        learning_rate=0.1,
        random_state=42,
        class_weight="balanced",
        verbose=-1
    ),
}

# Maps each fitted model's raw Python class name back to the registry
# name used everywhere else (MODEL_REGISTRY keys, "Best Performing Model"
# panel, model_comparison.csv). Without this, ML/predict.py's
# type(model).__name__ surfaces "LGBMClassifier"/"XGBClassifier"/
# "RandomForestClassifier" as "Model Used" on live predictions - a
# different label than "LightGBM"/"XGBoost"/"RandomForest" shown as the
# selected best model elsewhere on the same dashboard, for the same model.
MODEL_CLASS_TO_NAME = {
    "RandomForestClassifier": "RandomForest",
    "XGBClassifier": "XGBoost",
    "LGBMClassifier": "LightGBM",
}

# Models with no native class_weight support - evaluate_models.py computes
# sklearn.utils.class_weight.compute_sample_weight("balanced", y_train)
# and passes it as sample_weight at .fit() time for these instead.
MODELS_NEEDING_SAMPLE_WEIGHT = {"XGBoost"}

# File name each model is saved under inside ML/models/.
MODEL_FILENAMES = {
    "RandomForest": "random_forest.pkl",
    "XGBoost": "xgboost.pkl",
    "LightGBM": "lightgbm.pkl",
}

DEFAULT_SELECTION_METRIC = "macro_f1"

# Metrics eligible for --metric; higher is always better for all of them.
SELECTABLE_METRICS = (
    "accuracy",
    "precision",
    "recall",
    "f1_score",
    "roc_auc",
    "macro_f1",
    "high_risk_recall",
    "extreme_risk_recall",
)

# Approved model-selection tie-break rule: within this many macro-F1
# percentage points of the top score, a model with a materially better
# High-risk or Extreme-risk recall (also gated by this many points, on
# the 0-1 recall scale) is preferred over the raw macro-F1 leader.
MACRO_F1_TIE_MARGIN = 0.02
RECALL_IMPROVEMENT_MARGIN = 0.05


def get_model_registry():
    return MODEL_REGISTRY


def select_best_model(results, metric=DEFAULT_SELECTION_METRIC):
    """
    Pick the best result dict (as produced by evaluate_models.evaluate_model).

    Default rule (per the approved methodology): primary = macro_f1,
    secondary = high_risk_recall, tertiary = extreme_risk_recall. Models
    within MACRO_F1_TIE_MARGIN of the top macro-F1 score are treated as
    tied on the primary metric; among those, the model with the best
    High-risk recall wins if it beats the raw macro-F1 leader by at least
    RECALL_IMPROVEMENT_MARGIN (falling back to Extreme-risk recall as a
    second tie-break). Passing a different `metric` (e.g. for the CLI's
    --metric override) bypasses this hierarchy and just maximizes that
    single metric, with f1_score/accuracy as deterministic tie-breakers.
    """

    if metric not in SELECTABLE_METRICS:
        raise ValueError(
            f"Unknown selection metric '{metric}'. "
            f"Choose one of: {', '.join(SELECTABLE_METRICS)}"
        )

    if metric != DEFAULT_SELECTION_METRIC:
        def sort_key(result):
            primary = result.get(metric)
            primary = primary if primary is not None else -1
            return (primary, result["f1_score"], result["accuracy"])

        best = max(results, key=sort_key)
        logger.info(f"Selected best model: {best['name']} (selection metric='{metric}', value={best.get(metric)})")
        return best

    ranked = sorted(results, key=lambda r: r["macro_f1"], reverse=True)
    macro_f1_leader = ranked[0]

    contenders = [
        r for r in ranked
        if macro_f1_leader["macro_f1"] - r["macro_f1"] <= MACRO_F1_TIE_MARGIN
    ]

    best = macro_f1_leader
    reason = f"highest macro-F1 ({macro_f1_leader['macro_f1']:.4f})"

    if len(contenders) > 1:
        by_high_recall = max(contenders, key=lambda r: r["high_risk_recall"])
        if (
            by_high_recall["name"] != macro_f1_leader["name"]
            and by_high_recall["high_risk_recall"] - macro_f1_leader["high_risk_recall"] >= RECALL_IMPROVEMENT_MARGIN
        ):
            best = by_high_recall
            reason = (
                f"macro-F1 tied with {macro_f1_leader['name']} (within {MACRO_F1_TIE_MARGIN}), "
                f"but High-risk recall is {by_high_recall['high_risk_recall']:.4f} vs "
                f"{macro_f1_leader['high_risk_recall']:.4f} - preferred for the dangerous-class recall margin"
            )
        else:
            by_extreme_recall = max(contenders, key=lambda r: r["extreme_risk_recall"])
            if (
                by_extreme_recall["name"] != macro_f1_leader["name"]
                and by_extreme_recall["extreme_risk_recall"] - macro_f1_leader["extreme_risk_recall"] >= RECALL_IMPROVEMENT_MARGIN
            ):
                best = by_extreme_recall
                reason = (
                    f"macro-F1 tied with {macro_f1_leader['name']} (within {MACRO_F1_TIE_MARGIN}), "
                    f"but Extreme-risk recall is {by_extreme_recall['extreme_risk_recall']:.4f} vs "
                    f"{macro_f1_leader['extreme_risk_recall']:.4f} - preferred for the dangerous-class recall margin"
                )

    logger.info(f"Selected best model: {best['name']} ({reason})")
    best["selection_reason"] = reason

    return best
