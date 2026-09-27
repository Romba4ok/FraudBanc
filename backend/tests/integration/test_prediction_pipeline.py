from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.core.model_loader import load_artifacts
from app.services.metrics import calculate_metrics
from app.services.predictor import predict_frame
from app.training.train import train_model


def _training_frame(rows: int = 96) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "signal": (index % 12) + (8 if index % 8 == 0 else 0),
                "amount": 100_000 + index * 500,
                "term": 12 + index % 24,
                "income": 50_000 + index * 100,
                "age": 20 + index % 40,
                "GENDER": "515" if index % 2 else "516",
                "GB_flag": 1 if index % 8 == 0 else 0,
            }
            for index in range(rows)
        ]
    )


def test_real_catboost_prediction_and_native_shap(tmp_path: Path) -> None:
    training_path = tmp_path / "training.csv"
    artifact_path = tmp_path / "artifacts"
    frame = _training_frame()
    frame.to_csv(training_path, sep=";", index=False)
    train_model(training_path, artifact_path, iterations=12, random_seed=23)
    model, manifest = load_artifacts(artifact_path)

    sample_with_target = frame.iloc[:8].copy()
    sample_without_target = sample_with_target.drop(columns=["GB_flag"])
    with_target = predict_frame(sample_with_target, model, manifest, batch_size=3)
    without_target = predict_frame(sample_without_target, model, manifest, batch_size=3)

    assert with_target.probabilities == without_target.probabilities
    assert all(3 <= len(row["explanation_factors"]) <= 5 for row in with_target.rows)
    assert all(
        factor["feature"] != "GB_flag"
        for row in with_target.rows
        for factor in row["explanation_factors"]
    )
    metrics = calculate_metrics(
        sample_with_target["GB_flag"],
        with_target.probabilities,
        manifest.review_threshold,
    )
    assert metrics.available is True
    assert metrics.confusion_matrix is not None
