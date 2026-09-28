from __future__ import annotations

import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.model_loader import load_artifacts
from app.main import create_app
from app.services.session_store import SessionStore


def evaluation() -> dict:
    return {
        "holdout": {"rows": 1000, "roc_auc": 0.86, "pr_auc": 0.32},
        "temporal_backtest": {"windows": 3, "max_metric_drop": 0.03},
        "drift": {"max_psi": 0.08},
        "leakage": {"target_as_feature": False, "suspected_features": []},
        "calibration": {"rows": 1000, "expected_calibration_error": 0.04},
        "alert_volume": {"rate": 0.02, "champion_delta": 0.002},
    }


def test_candidate_cannot_activate_without_gates_and_manual_confirmation(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "artifacts" / "current"
    model, manifest = load_artifacts(source)
    artifact_root = tmp_path / "artifacts"
    current = artifact_root / "current"
    shutil.copytree(source, current)
    candidate = artifact_root / "candidates" / "client_risk" / manifest.model_version
    shutil.copytree(source, candidate)
    app = create_app(
        model=model,
        manifest=manifest,
        artifact_dir=current,
        session_store=SessionStore(tmp_path / "sessions"),
        dictionary_path=None,
        transaction_artifact_dir=tmp_path / "no-transactions",
    )
    with TestClient(app) as client:
        registered = client.post("/api/models/candidates", json={
            "profile": "client_risk",
            "version": manifest.model_version,
            "evaluation": evaluation(),
        })
        assert registered.status_code == 201, registered.text
        assert registered.json()["state"] == "eligible"

        denied = client.post(
            f"/api/models/client_risk/{manifest.model_version}/activate",
            json={"actor": "risk-owner", "reason": "Проверки пройдены", "confirmation": "yes"},
        )
        assert denied.status_code == 409
        assert denied.json()["error"]["code"] == "activation_blocked"

        activated = client.post(
            f"/api/models/client_risk/{manifest.model_version}/activate",
            json={
                "actor": "risk-owner",
                "reason": "Проверки пройдены",
                "confirmation": f"ACTIVATE {manifest.model_version}",
            },
        )
        assert activated.status_code == 200, activated.text
        assert activated.json()["state"] == "champion"
        assert client.get("/api/model").json()["version"] == manifest.model_version
        audit = client.get("/api/models/audit", params={"profile": "client_risk"}).json()["items"]
        assert audit[0]["action"] == "activated"
