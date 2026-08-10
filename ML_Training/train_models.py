import pandas as pd
import joblib
import time

from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from sklearn.preprocessing import LabelEncoder

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)


# ==========================================================
# Load and Prepare Data
# ==========================================================

def prepare_data(train_file, test_file):

    train_df = pd.read_csv(train_file)
    test_df = pd.read_csv(test_file)

    # Encode City
    city_encoder = LabelEncoder()

    all_cities = pd.concat(
        [train_df["City"], test_df["City"]],
        ignore_index=True
    )

    city_encoder.fit(all_cities)

    train_df["City_Encoded"] = city_encoder.transform(train_df["City"])
    test_df["City_Encoded"] = city_encoder.transform(test_df["City"])

    # Features
    feature_columns = [
        "City_Encoded",
        "Rainfall_3Day",
        "Avg_Temperature",
        "Avg_WindSpeed",
        "Elevation"
    ]

    X_train = train_df[feature_columns]
    X_test = test_df[feature_columns]

    # Target
    label_encoder = LabelEncoder()

    y_train = label_encoder.fit_transform(train_df["Flood_Risk"])
    y_test = label_encoder.transform(test_df["Flood_Risk"])

    return (
        X_train,
        X_test,
        y_train,
        y_test,
        city_encoder,
        label_encoder
    )


# ==========================================================
# Generic Evaluation Function
# ==========================================================

def evaluate_model(model, model_name,
                   X_train, X_test,
                   y_train, y_test):

    # Training
    train_start = time.time()

    model.fit(X_train, y_train)

    training_time = time.time() - train_start

    # Prediction
    predict_start = time.time()

    y_pred = model.predict(X_test)

    prediction_time = time.time() - predict_start

    accuracy = accuracy_score(y_test, y_pred)

    precision = precision_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    recall = recall_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    report = classification_report(
        y_test,
        y_pred,
        output_dict=True,
        zero_division=0
    )

    matrix = confusion_matrix(y_test, y_pred)

    return {
        "name": model_name,
        "model": model,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "training_time": training_time,
        "prediction_time": prediction_time,
        "report": report,
        "matrix": matrix
    }


# ==========================================================
# Compare Models
# ==========================================================

def compare_models(train_file, test_file):

    (
        X_train,
        X_test,
        y_train,
        y_test,
        city_encoder,
        label_encoder
    ) = prepare_data(train_file, test_file)

    models = [

        (
            "Random Forest",
            RandomForestClassifier(
                n_estimators=100,
                random_state=42
            )
        ),

        (
            "XGBoost",
            XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                eval_metric="mlogloss"
            )
        ),

        (
            "LightGBM",
            LGBMClassifier(
                n_estimators=100,
                learning_rate=0.1,
                random_state=42
            )
        )
    ]

    results = []

    for model_name, model in models:

        result = evaluate_model(
            model,
            model_name,
            X_train,
            X_test,
            y_train,
            y_test
        )

        results.append(result)

    comparison_df = pd.DataFrame([
        {
            "Model": r["name"],
            "Accuracy": r["accuracy"],
            "Precision": r["precision"],
            "Recall": r["recall"],
            "F1 Score": r["f1"],
            "Training Time": r["training_time"],
            "Prediction Time": r["prediction_time"]
        }
        for r in results
    ])

    best_model = max(
        results,
        key=lambda x: (x["accuracy"], x["f1"])
    )

    comparison_df["Selected"] = comparison_df["Model"].apply(
        lambda x: "Yes" if x == best_model["name"] else "No"
    )

    comparison_df.to_csv(
        "ML_Training/model_results.csv",
        index=False
    )

    joblib.dump(
        best_model["model"],
        "ML_Training/flood_prediction_model.pkl"
    )

    joblib.dump(
        city_encoder,
        "ML_Training/city_encoder.pkl"
    )

    joblib.dump(
        label_encoder,
        "ML_Training/flood_label_encoder.pkl"
    )

    return results, best_model