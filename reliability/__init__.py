"""
Data Source Reliability layer: pure, DB-free scoring logic shared by the
live backend service (backend/services/reliability_service.py), the ML
training pipeline (ML/prepare_dataset.py, ML/train_models.py) and the
degraded-data research experiments (ML/run_reliability_experiments.py).

    Reliability Score = w1*Completeness + w2*Timeliness
                       + w3*Validity + w4*Historical Reliability

See reliability/config.py for all configurable weights/thresholds.
"""
