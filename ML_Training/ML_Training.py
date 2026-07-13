# =========================================================
# PROFESSIONAL FLOOD PREDICTION ML DASHBOARD
# USING CUSTOMTKINTER
# =========================================================

import customtkinter as ctk
from tkinter import filedialog, messagebox

import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# =========================================================
# APP CONFIGURATION
# =========================================================

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# =========================================================
# MAIN APPLICATION
# =========================================================

class FloodPredictionDashboard(ctk.CTk):

    def __init__(self):

        super().__init__()

        # -------------------------------------------------
        # WINDOW SETTINGS
        # -------------------------------------------------

        self.title("Flood Prediction ML Dashboard")

        self.geometry("1600x900")

        self.minsize(1400, 850)

        # -------------------------------------------------
        # VARIABLES
        # -------------------------------------------------

        self.train_file = ""
        self.test_file = ""

        # -------------------------------------------------
        # MAIN LAYOUT
        # -------------------------------------------------

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # =================================================
        # SIDEBAR
        # =================================================

        self.sidebar = ctk.CTkFrame(
            self,
            width=280,
            corner_radius=0
        )

        self.sidebar.grid(
            row=0,
            column=0,
            sticky="ns"
        )

        # Sidebar Title

        self.logo_label = ctk.CTkLabel(
            self.sidebar,
            text="🌊 Flood ",
            font=("Segoe UI", 30, "bold")
        )

        self.logo_label.pack(pady=(40, 30))

        # Sidebar Description

        self.desc_label = ctk.CTkLabel(
            self.sidebar,
            text="Flood Prediction\nMonitoring System",
            font=("Segoe UI", 18)
        )

        self.desc_label.pack(pady=(0, 40))

        # Upload Train Dataset Button

        self.train_btn = ctk.CTkButton(
            self.sidebar,
            text="📂 Upload Train Dataset",
            height=50,
            font=("Segoe UI", 16, "bold"),
            command=self.load_train_dataset
        )

        self.train_btn.pack(
            padx=20,
            pady=15,
            fill="x"
        )

        # Upload Test Dataset Button

        self.test_btn = ctk.CTkButton(
            self.sidebar,
            text="📂 Upload Test Dataset",
            height=50,
            font=("Segoe UI", 16, "bold"),
            command=self.load_test_dataset
        )

        self.test_btn.pack(
            padx=20,
            pady=15,
            fill="x"
        )

        # Train Model Button

        self.train_model_btn = ctk.CTkButton(
            self.sidebar,
            text="🚀 Train ML Model",
            height=60,
            font=("Segoe UI", 18, "bold"),
            fg_color="#2563EB",
            hover_color="#1D4ED8",
            command=self.train_model
        )

        self.train_model_btn.pack(
            padx=20,
            pady=30,
            fill="x"
        )

        # Status Label

        self.status_label = ctk.CTkLabel(
            self.sidebar,
            text="🔴 Waiting for datasets",
            font=("Segoe UI", 15)
        )

        self.status_label.pack(pady=20)

        # =================================================
        # MAIN CONTENT AREA
        # =================================================

        self.main_frame = ctk.CTkFrame(
            self,
            corner_radius=0
        )

        self.main_frame.grid(
            row=0,
            column=1,
            sticky="nsew"
        )

        self.main_frame.grid_columnconfigure(
            (0, 1, 2),
            weight=1
        )

        # =================================================
        # HEADER
        # =================================================

        self.header = ctk.CTkLabel(
            self.main_frame,
            text="Flood Prediction Machine Learning Dashboard",
            font=("Segoe UI", 34, "bold")
        )

        self.header.grid(
            row=0,
            column=0,
            columnspan=3,
            pady=(30, 20)
        )

        # =================================================
        # STATISTICS CARDS
        # =================================================

        # Accuracy Card

        self.accuracy_card = ctk.CTkFrame(
            self.main_frame,
            height=160,
            corner_radius=20
        )

        self.accuracy_card.grid(
            row=1,
            column=0,
            padx=20,
            pady=10,
            sticky="nsew"
        )

        self.accuracy_title = ctk.CTkLabel(
            self.accuracy_card,
            text="🎯 Model Accuracy",
            font=("Segoe UI", 22, "bold")
        )

        self.accuracy_title.pack(pady=(20, 10))

        self.accuracy_value = ctk.CTkLabel(
            self.accuracy_card,
            text="0%",
            font=("Segoe UI", 40, "bold"),
            text_color="#22C55E"
        )

        self.accuracy_value.pack()

        # Training Status Card

        self.training_card = ctk.CTkFrame(
            self.main_frame,
            height=160,
            corner_radius=20
        )

        self.training_card.grid(
            row=1,
            column=1,
            padx=20,
            pady=10,
            sticky="nsew"
        )

        self.training_title = ctk.CTkLabel(
            self.training_card,
            text="⚙️ Training Status",
            font=("Segoe UI", 22, "bold")
        )

        self.training_title.pack(pady=(20, 10))

        self.training_status = ctk.CTkLabel(
            self.training_card,
            text="Idle",
            font=("Segoe UI", 28, "bold"),
            text_color="#F59E0B"
        )

        self.training_status.pack()

        # Dataset Card

        self.dataset_card = ctk.CTkFrame(
            self.main_frame,
            height=160,
            corner_radius=20
        )

        self.dataset_card.grid(
            row=1,
            column=2,
            padx=20,
            pady=10,
            sticky="nsew"
        )

        self.dataset_title = ctk.CTkLabel(
            self.dataset_card,
            text="📊 Dataset Status",
            font=("Segoe UI", 22, "bold")
        )

        self.dataset_title.pack(pady=(20, 10))

        self.dataset_status = ctk.CTkLabel(
            self.dataset_card,
            text="Not Loaded",
            font=("Segoe UI", 24, "bold"),
            text_color="#EF4444"
        )

        self.dataset_status.pack()

        # =================================================
        # PROGRESS BAR
        # =================================================

        self.progress_label = ctk.CTkLabel(
            self.main_frame,
            text="Training Progress",
            font=("Segoe UI", 18, "bold")
        )

        self.progress_label.grid(
            row=2,
            column=0,
            columnspan=3,
            pady=(20, 5)
        )

        self.progress_bar = ctk.CTkProgressBar(
            self.main_frame,
            width=1100,
            height=20
        )

        self.progress_bar.grid(
            row=3,
            column=0,
            columnspan=3,
            padx=40,
            pady=(0, 20)
        )

        self.progress_bar.set(0)

        # =================================================
        # TERMINAL OUTPUT
        # =================================================

        self.output_box = ctk.CTkTextbox(
            self.main_frame,
            width=1200,
            height=420,
            font=("Consolas", 15),
            corner_radius=15
        )

        self.output_box.grid(
            row=4,
            column=0,
            columnspan=3,
            padx=30,
            pady=20,
            sticky="nsew"
        )

    # =====================================================
    # LOAD TRAIN DATASET
    # =====================================================

    def load_train_dataset(self):

        file_path = filedialog.askopenfilename(
            title="Select Train Dataset",
            filetypes=[("CSV Files", "*.csv")]
        )

        if file_path:

            self.train_file = file_path

            self.log_output(
                f"✅ Train Dataset Loaded:\n{file_path}\n"
            )

            self.check_dataset_status()

    # =====================================================
    # LOAD TEST DATASET
    # =====================================================

    def load_test_dataset(self):

        file_path = filedialog.askopenfilename(
            title="Select Test Dataset",
            filetypes=[("CSV Files", "*.csv")]
        )

        if file_path:

            self.test_file = file_path

            self.log_output(
                f"✅ Test Dataset Loaded:\n{file_path}\n"
            )

            self.check_dataset_status()

    # =====================================================
    # CHECK DATASET STATUS
    # =====================================================

    def check_dataset_status(self):

        if self.train_file and self.test_file:

            self.dataset_status.configure(
                text="Loaded",
                text_color="#22C55E"
            )

            self.status_label.configure(
                text="🟢 Ready for Training"
            )

    # =====================================================
    # LOG OUTPUT
    # =====================================================

    def log_output(self, text):

        self.output_box.insert("end", text + "\n")

        self.output_box.see("end")

    # =====================================================
    # TRAIN MODEL
    # =====================================================

    def train_model(self):

        try:

            if not self.train_file or not self.test_file:

                messagebox.showerror(
                    "Error",
                    "Please load both datasets"
                )

                return

            # Update UI

            self.training_status.configure(
                text="Training...",
                text_color="#F59E0B"
            )

            self.progress_bar.set(0.1)

            self.log_output("🚀 Starting model training...\n")

            # Load datasets

            train_df = pd.read_csv(self.train_file)
            test_df = pd.read_csv(self.test_file)

            self.progress_bar.set(0.3)

            self.log_output("✅ Datasets loaded successfully")

            # Encode city

            city_encoder = LabelEncoder()

            all_cities = pd.concat([
                train_df['City'],
                test_df['City']
            ])

            city_encoder.fit(all_cities)

            train_df['City_Encoded'] = city_encoder.transform(
                train_df['City']
            )

            test_df['City_Encoded'] = city_encoder.transform(
                test_df['City']
            )

            # Features

            X_train = train_df[[
                'City_Encoded',
                'Rainfall_3Day',
                'Avg_Temperature',
                'Avg_WindSpeed',
                'Elevation'
            ]]

            X_test = test_df[[
                'City_Encoded',
                'Rainfall_3Day',
                'Avg_Temperature',
                'Avg_WindSpeed',
                'Elevation'
            ]]

            y_train = train_df['Flood_Risk']
            y_test = test_df['Flood_Risk']

            # Encode labels

            label_encoder = LabelEncoder()

            y_train_encoded = label_encoder.fit_transform(
                y_train
            )

            y_test_encoded = label_encoder.transform(
                y_test
            )

            self.progress_bar.set(0.6)

            self.log_output("⚙️ Training Random Forest Model...")

            # Create model

            model = RandomForestClassifier(
                n_estimators=100,
                random_state=42
            )

            # Train

            model.fit(
                X_train,
                y_train_encoded
            )

            self.progress_bar.set(0.8)

            # Predict

            y_pred = model.predict(X_test)

            accuracy = accuracy_score(
                y_test_encoded,
                y_pred
            )

            accuracy_percent = accuracy * 100

            # Update UI

            self.accuracy_value.configure(
                text=f"{accuracy_percent:.2f}%"
            )

            self.training_status.configure(
                text="Completed",
                text_color="#22C55E"
            )

            # Save model

            joblib.dump(
                model,
                "flood_prediction_model.pkl"
            )

            joblib.dump(
                city_encoder,
                "city_encoder.pkl"
            )

            joblib.dump(
                label_encoder,
                "flood_label_encoder.pkl"
            )

            self.progress_bar.set(1.0)

            # Reports

            report = classification_report(
                y_test_encoded,
                y_pred,
                target_names=label_encoder.classes_
            )

            matrix = confusion_matrix(
                y_test_encoded,
                y_pred
            )

            # Output logs

            self.log_output(
                f"\n🎯 Accuracy: {accuracy_percent:.2f}%\n"
            )

            self.log_output(
                "📄 Classification Report:\n"
            )

            self.log_output(report)

            self.log_output(
                "\n📊 Confusion Matrix:\n"
            )

            self.log_output(str(matrix))

            self.log_output(
                "\n✅ Model saved successfully!"
            )

            messagebox.showinfo(
                "Success",
                "Flood Prediction Model Trained Successfully!"
            )

        except Exception as e:

            messagebox.showerror(
                "Error",
                str(e)
            )

# =========================================================
# RUN APPLICATION
# =========================================================

if __name__ == "__main__":

    app = FloodPredictionDashboard()

    app.mainloop()