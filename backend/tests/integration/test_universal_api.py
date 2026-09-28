from __future__ import annotations

import csv
import io
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.preprocessing import build_manifest
from app.training.generate_synthetic_transactions import generate_synthetic_dataset
from app.training.train_transactions import train_transaction_model


class _ClientModel:
    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        probabilities = np.clip(features["signal"].to_numpy(dtype=float) / 10, 0, 1)
        return np.column_stack([1 - probabilities, probabilities])

    def get_feature_importance(self, pool, type: str) -> np.ndarray:  # noqa: A002
        assert type == "ShapValues"
        values = np.ones((pool.num_row(), pool.num_col()), dtype="float64")
        return np.column_stack([values, np.zeros(pool.num_row())])


def _client_manifest():
    frame = pd.DataFrame(
        {
            "signal": [1, 9, 4, 7],
            "amount": [100, 900, 400, 700],
            "term": [12, 24, 18, 30],
            "income": [500, 400, 300, 600],
            "age": [20, 50, 35, 42],
            "GENDER": ["515", "516", "515", "516"],
            "GB_flag": [0, 1, 0, 1],
        }
    )
    manifest = build_manifest(frame)
    manifest.model_version = "universal-api-client"
    manifest.review_threshold = 0.5
    manifest.risk_boundaries = {"medium": 0.25, "high": 0.5, "critical": 0.85}
    return manifest


def _wait(client: TestClient, analysis_id: str, terminal: set[str]) -> dict:
    for _ in range(600):
        response = client.get(f"/api/analyses/{analysis_id}/status")
        assert response.status_code == 200, response.text
        payload = response.json()
        if payload["status"] in terminal:
            return payload
        time.sleep(0.01)
    raise AssertionError("Analysis did not reach the expected state.")


@pytest.fixture(scope="module")
def transaction_api_fixture(tmp_path_factory: pytest.TempPathFactory):
    root = tmp_path_factory.mktemp("d012-api")
    fixture = root / "fixture"
    artifacts = root / "transaction-artifacts"
    generate_synthetic_dataset(fixture, seed=313, normal_rows=1_000)
    train_transaction_model(
        fixture / "transactions.csv",
        artifacts,
        model_version="transaction-api-1.0",
        random_seed=313,
        estimators=20,
        chunk_size=127,
    )
    return root, artifacts, (fixture / "transactions.csv").read_bytes()


def test_universal_api_plan_run_pages_exports_feedback_and_delete(
    transaction_api_fixture,
) -> None:
    root, transaction_artifacts, content = transaction_api_fixture
    app = create_app(
        model=_ClientModel(),
        manifest=_client_manifest(),
        session_dir=root / "sessions",
        dictionary_path=None,
        transaction_artifact_dir=transaction_artifacts,
    )
    with TestClient(app) as client:
        created = client.post(
            "/api/analyses",
            params={"auto_run": False},
            files={"file": ("transactions.csv", content, "text/csv")},
        )
        assert created.status_code == 202, created.text
        analysis_id = created.json()["analysis_id"]
        assert _wait(client, analysis_id, {"planned", "failed"})["status"] == "planned"

        inventory = client.get(f"/api/analyses/{analysis_id}/inventory")
        plan = client.get(f"/api/analyses/{analysis_id}/plan")
        assert inventory.status_code == plan.status_code == 200
        assert inventory.json()["datasets"][0]["row_count"] == 1068
        assert any(item["profile"] == "transaction_anomaly" and item["state"] == "planned" for item in plan.json()["profiles"])

        period = plan.json()["time_range"]
        patched = client.patch(
            f"/api/analyses/{analysis_id}/plan",
            json={"start": period["start"], "end": period["end"]},
        )
        assert patched.status_code == 200

        started = client.post(f"/api/analyses/{analysis_id}/run")
        assert started.status_code == 202, started.text
        finished = _wait(client, analysis_id, {"completed", "failed", "cancelled"})
        assert finished["status"] == "completed", finished

        summary = client.get(f"/api/analyses/{analysis_id}/summary")
        assert summary.status_code == 200, summary.text
        summary_payload = summary.json()
        assert summary_payload["summary"]["rows"] == 4
        assert set(summary_payload["summary"]["risk_counts"]) == {
            "low",
            "medium",
            "high",
            "critical",
        }
        assert sum(summary_payload["summary"]["risk_counts"].values()) == 4
        assert isinstance(summary_payload["summary"]["warnings"], list)
        assert summary_payload["summary"]["target_present"] is False
        assert summary_payload["summary"]["target_valid"] is False

        first = client.get(
            f"/api/analyses/{analysis_id}/transactions",
            params={"page": 1, "page_size": 20},
        ).json()
        second = client.get(
            f"/api/analyses/{analysis_id}/transactions",
            params={"page": 2, "page_size": 20},
        ).json()
        assert first["total"] == 1068, finished
        assert [item["risk_probability"] for item in first["items"]] == sorted(
            [item["risk_probability"] for item in first["items"]], reverse=True
        )
        assert {item["record_id"] for item in first["items"]}.isdisjoint(
            {item["record_id"] for item in second["items"]}
        )
        reviewed = client.get(
            f"/api/analyses/{analysis_id}/transactions",
            params={"requires_review": True, "probability_min": 0.72, "page_size": 100},
        ).json()
        assert reviewed["items"]
        assert all(item["requires_review"] and item["risk_probability"] >= 0.72 for item in reviewed["items"])

        relation_page = client.get(
            f"/api/analyses/{analysis_id}/relationships",
            params={"kind": "transfer", "page_size": 10},
        ).json()
        assert relation_page["total"] == 1068
        relation = relation_page["items"][0]
        by_entity = client.get(
            f"/api/analyses/{analysis_id}/relationships",
            params={"entity_id": relation["from_id"], "page_size": 100},
        ).json()
        assert by_entity["items"]

        feedback = client.patch(
            f"/api/analyses/{analysis_id}/investigations/{first['items'][0]['record_id']}",
            json={"status": "in_review", "comment": "Проверить источник операции"},
        )
        assert feedback.status_code == 200
        assert feedback.json()["status"] == "in_review"
        assert feedback.json()["confirmed_label"] is None
        investigation = client.get(
            f"/api/analyses/{analysis_id}/investigations/{first['items'][0]['record_id']}"
        )
        assert investigation.status_code == 200
        assert investigation.json()["history"][0]["status"] == "in_review"
        confirmed = client.patch(
            f"/api/analyses/{analysis_id}/investigations/{first['items'][0]['record_id']}",
            json={"status": "confirmed", "comment": "Мошенничество подтверждено аналитиком"},
        )
        assert confirmed.json()["confirmed_label"]["source"] == "human_confirmed"
        feedback_store = client.get(f"/api/analyses/{analysis_id}/feedback").json()
        assert feedback_store["total_confirmed"] == 1
        assert feedback_store["confirmed_labels"][0]["entity_key"] != first["items"][0]["record_id"]

        for kind in ("full", "review", "transactions", "relationships", "mapping_quality"):
            exported = client.get(f"/api/analyses/{analysis_id}/exports/{kind}")
            assert exported.status_code == 200, (kind, exported.text)
            assert "attachment" in exported.headers["content-disposition"]
            assert exported.headers["x-data-masking"] == "masked"
            assert exported.text
        technical = client.get(f"/api/analyses/{analysis_id}/exports/technical_plan")
        assert technical.status_code == 200
        assert technical.json()["analysis_id"] == analysis_id

        transaction_csv = client.get(
            f"/api/analyses/{analysis_id}/exports/transactions",
            params={"masked": False},
        )
        rows = list(csv.DictReader(io.StringIO(transaction_csv.text)))
        assert len(rows) == 1068
        assert rows[0]["sender_account_id"].startswith("SYN-")

        session_dir = root / "sessions" / analysis_id
        assert session_dir.exists()
        assert client.delete(f"/api/analyses/{analysis_id}").status_code == 204
        assert not session_dir.exists()
        assert client.get(f"/api/analyses/{analysis_id}/status").status_code == 404


def test_prepared_analysis_can_be_cancelled_and_removes_source(tmp_path: Path) -> None:
    app = create_app(
        model=_ClientModel(),
        manifest=_client_manifest(),
        session_dir=tmp_path / "sessions",
        dictionary_path=None,
    )
    content = b"signal,amount,term,income,age,GENDER\n1,100,12,500,30,515\n"
    with TestClient(app) as client:
        created = client.post(
            "/api/analyses",
            params={"auto_run": False},
            files={"file": ("clients.csv", content, "text/csv")},
        )
        analysis_id = created.json()["analysis_id"]
        assert _wait(client, analysis_id, {"planned", "failed"})["status"] == "planned"
        response = client.post(f"/api/analyses/{analysis_id}/cancel")
        assert response.status_code == 202
        assert response.json()["status"] == "cancelled"
        assert not (tmp_path / "sessions" / "_incoming" / analysis_id).exists()


def test_universal_client_results_are_exposed_with_stable_pages(tmp_path: Path) -> None:
    app = create_app(
        model=_ClientModel(),
        manifest=_client_manifest(),
        session_dir=tmp_path / "sessions",
        dictionary_path=None,
        transaction_artifact_dir=None,
    )
    content = (
        b"signal,amount,term,income,age,GENDER\n"
        b"1,100,12,500,30,515\n"
        b"9,900,24,400,50,516\n"
        b"4,400,18,300,35,515\n"
        b"7,700,30,600,42,516\n"
    )
    with TestClient(app) as client:
        created = client.post(
            "/api/analyses",
            params={"auto_run": False},
            files={"file": ("clients.csv", content, "text/csv")},
        )
        assert created.status_code == 202, created.text
        analysis_id = created.json()["analysis_id"]
        assert _wait(client, analysis_id, {"planned", "failed"})["status"] == "planned"

        plan = client.get(f"/api/analyses/{analysis_id}/plan").json()
        assert any(
            item["profile"] == "client_risk" and item["state"] == "planned"
            for item in plan["profiles"]
        )
        assert client.post(f"/api/analyses/{analysis_id}/run").status_code == 202
        finished = _wait(client, analysis_id, {"completed", "failed", "cancelled"})
        assert finished["status"] == "completed", finished

        first = client.get(
            f"/api/analyses/{analysis_id}/clients",
            params={"page": 1, "page_size": 2},
        )
        second = client.get(
            f"/api/analyses/{analysis_id}/clients",
            params={"page": 2, "page_size": 2},
        )
        assert first.status_code == second.status_code == 200
        first_payload = first.json()
        second_payload = second.json()
        assert first_payload["total"] == second_payload["total"] == 4
        assert [item["risk_probability"] for item in first_payload["items"]] == [0.9, 0.7]
        assert [item["risk_probability"] for item in second_payload["items"]] == [0.4, 0.1]
