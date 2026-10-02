from __future__ import annotations

import csv
import io
import sqlite3
import threading
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.preprocessing import build_manifest
from app.services.session_store import SessionStore


class ApiFakeModel:
    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        probabilities = np.clip(features["signal"].to_numpy(dtype=float) / 10, 0, 1)
        return np.column_stack([1 - probabilities, probabilities])

    def get_feature_importance(self, pool, type: str):  # noqa: A002
        assert type == "ShapValues"
        rows, columns = pool.num_row(), pool.num_col()
        values = np.tile(np.arange(1, columns + 1, dtype=float), (rows, 1))
        return np.column_stack([values, np.zeros(rows)])


def model_frame() -> pd.DataFrame:
    return pd.DataFrame(
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


def csv_bytes(*, include_target: bool = True, extra: bool = True) -> bytes:
    frame = model_frame()
    if not include_target:
        frame = frame.drop(columns=["GB_flag"])
    if extra:
        frame["comment"] = ["first", "most risky", "third", "second"]
    return frame.to_csv(sep=";", index=False).encode("utf-8")


def wait_until_finished(client: TestClient, analysis_id: str) -> dict:
    observed = []
    for _ in range(200):
        response = client.get(f"/api/analyses/{analysis_id}/status")
        assert response.status_code == 200
        payload = response.json()
        observed.append(payload["status"])
        assert 0 <= payload["progress"] <= 100
        if payload["status"] in {"completed", "failed", "cancelled"}:
            payload["observed_statuses"] = observed
            return payload
        time.sleep(0.01)
    raise AssertionError("Analysis did not finish in time.")


def create_test_app(
    tmp_path: Path,
    *,
    max_bytes: int = 1024 * 1024,
    max_records: int = 1_000_000,
):
    manifest = build_manifest(model_frame())
    manifest.model_version = "api-test"
    manifest.review_threshold = 0.5
    return create_app(
        model=ApiFakeModel(),
        manifest=manifest,
        session_dir=tmp_path / "sessions",
        max_input_bytes=max_bytes,
        max_input_records=max_records,
        dictionary_path=None,
    )


def upload(client: TestClient, content: bytes, name: str = "sample.csv") -> str:
    response = client.post(
        "/api/analyses",
        files={"file": (name, content, "text/csv")},
    )
    assert response.status_code == 202, response.text
    return response.json()["analysis_id"]


def test_health_and_model_status(tmp_path: Path) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        assert client.get("/api/health").json() == {
            "status": "ok",
            "model_ready": True,
        }
        model = client.get("/api/model").json()
        assert model["ready"] is True
        assert model["version"] == "api-test"
        assert model["features"] == 6


def test_full_api_cycle_with_target_sort_filter_threshold_report_delete(
    tmp_path: Path,
) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        analysis_id = upload(client, csv_bytes(include_target=True))
        status_payload = wait_until_finished(client, analysis_id)
        assert status_payload["status"] == "completed"
        assert status_payload["progress"] == 100

        summary = client.get(f"/api/analyses/{analysis_id}/summary").json()
        assert summary["summary"]["rows"] == 4
        assert summary["summary"]["target_present"] is True
        assert summary["metrics"]["available"] is True
        assert summary["summary"]["warnings"]

        first_page = client.get(
            f"/api/analyses/{analysis_id}/results",
            params={"page": 1, "page_size": 2},
        ).json()
        second_page = client.get(
            f"/api/analyses/{analysis_id}/results",
            params={"page": 2, "page_size": 2},
        ).json()
        probabilities = [
            item["risk_probability"]
            for item in first_page["items"] + second_page["items"]
        ]
        assert probabilities == sorted(probabilities, reverse=True)
        assert first_page["items"][0]["comment"] == "most risky"

        high = client.get(
            f"/api/analyses/{analysis_id}/results",
            params={"risk_level": "high", "page_size": 10},
        ).json()
        assert {item["risk_level"] for item in high["items"]} == {"high"}

        filtered = client.get(
            f"/api/analyses/{analysis_id}/results",
            params={
                "requires_review": True,
                "probability_min": 0.5,
                "probability_max": 1,
                "record_id": "row-",
                "page_size": 10,
            },
        ).json()
        assert filtered["items"]
        assert all(item["requires_review"] for item in filtered["items"])
        assert all(item["risk_probability"] >= 0.5 for item in filtered["items"])

        distribution = client.get(
            f"/api/analyses/{analysis_id}/distribution", params={"bins": 5}
        ).json()
        assert sum(distribution["risk_counts"].values()) == 4
        assert len(distribution["probability_histogram"]) == 5
        assert sum(item["count"] for item in distribution["probability_histogram"]) == 4
        assert distribution["probability_histogram"][0]["from"] == 0
        assert distribution["probability_histogram"][-1]["to"] == 1

        strict = client.get(
            f"/api/analyses/{analysis_id}/results",
            params={"threshold": 0.8, "page_size": 10},
        ).json()
        assert [item["requires_review"] for item in strict["items"]] == [
            True,
            False,
            False,
            False,
        ]
        strict_summary = client.get(
            f"/api/analyses/{analysis_id}/summary", params={"threshold": 0.8}
        ).json()
        assert strict_summary["threshold"] == 0.8
        assert strict_summary["summary"]["requires_review"] == 1
        assert strict_summary["metrics"]["threshold"] == 0.8

        report_response = client.get(
            f"/api/analyses/{analysis_id}/report.csv", params={"threshold": 0.8}
        )
        assert report_response.status_code == 200
        report = list(csv.DictReader(io.StringIO(report_response.text)))
        assert [float(row["risk_probability"]) for row in report] == probabilities
        assert report[0]["comment"] == "most risky"
        assert report[0]["requires_review"] == "True"
        assert report[1]["requires_review"] == "False"

        review_report_response = client.get(
            f"/api/analyses/{analysis_id}/report.csv",
            params={"threshold": 0.8, "requires_review": True},
        )
        assert review_report_response.status_code == 200
        assert "-review.csv" in review_report_response.headers["content-disposition"]
        review_report = list(csv.DictReader(io.StringIO(review_report_response.text)))
        assert len(review_report) == 1
        assert all(float(row["risk_probability"]) >= 0.8 for row in review_report)
        assert all(row["requires_review"] == "True" for row in review_report)

        assert client.delete(f"/api/analyses/{analysis_id}").status_code == 204
        missing = client.get(f"/api/analyses/{analysis_id}/status")
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "analysis_not_found"
        assert not (tmp_path / "sessions" / analysis_id).exists()


def test_target_is_optional_and_does_not_change_predictions(tmp_path: Path) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        with_target = upload(client, csv_bytes(include_target=True, extra=False))
        without_target = upload(client, csv_bytes(include_target=False, extra=False))
        assert wait_until_finished(client, with_target)["status"] == "completed"
        assert wait_until_finished(client, without_target)["status"] == "completed"

        with_rows = client.get(
            f"/api/analyses/{with_target}/results", params={"page_size": 10}
        ).json()["items"]
        without_rows = client.get(
            f"/api/analyses/{without_target}/results", params={"page_size": 10}
        ).json()["items"]
        assert [row["risk_probability"] for row in with_rows] == [
            row["risk_probability"] for row in without_rows
        ]
        summary = client.get(f"/api/analyses/{without_target}/summary").json()
        assert summary["summary"]["target_present"] is False
        assert summary["metrics"]["available"] is False


def test_failed_analysis_removes_partially_created_session(
    tmp_path: Path,
    monkeypatch,
) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        manager = client.app.state.analysis_manager
        original_create_session = manager.store.create_session

        def create_then_fail(*args, **kwargs):
            original_create_session(*args, **kwargs)
            raise RuntimeError("simulated failure after session creation")

        monkeypatch.setattr(manager.store, "create_session", create_then_fail)
        analysis_id = upload(client, csv_bytes(include_target=False, extra=False))
        failed = wait_until_finished(client, analysis_id)

        assert failed["status"] == "failed"
        assert not (tmp_path / "sessions" / analysis_id).exists()


def test_storage_full_failure_has_actionable_message(tmp_path: Path, monkeypatch) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        manager = client.app.state.analysis_manager

        def fail_when_persisting(*args, **kwargs):
            raise sqlite3.OperationalError("database or disk is full")

        monkeypatch.setattr(manager.store, "create_session", fail_when_persisting)
        analysis_id = upload(client, csv_bytes(include_target=False, extra=False))
        failed = wait_until_finished(client, analysis_id)

        assert failed["status"] == "failed"
        assert failed["stage"] == "storage_failed"
        assert "Завершите предыдущую сессию" in failed["errors"][0]


def test_rejects_oversize_unsupported_and_incompatible_csv(tmp_path: Path) -> None:
    exact_limit = csv_bytes(include_target=False, extra=False)
    with TestClient(create_test_app(tmp_path, max_bytes=len(exact_limit))) as client:
        accepted = upload(client, exact_limit, "exact-limit.csv")
        assert wait_until_finished(client, accepted)["status"] == "completed"

        oversized = client.post(
            "/api/analyses",
            files={"file": ("large.csv", exact_limit + b"x", "text/csv")},
        )
        assert oversized.status_code == 413
        assert oversized.json()["error"]["code"] == "file_too_large"
        assert not list((tmp_path / "sessions" / "_incoming").iterdir())

        unsupported = client.post(
            "/api/analyses",
            files={"file": ("sample.txt", b"a,b\n1,2", "text/plain")},
        )
        assert unsupported.status_code == 415

        invalid_query = client.get(
            f"/api/analyses/{accepted}/results", params={"threshold": 2}
        )
        assert invalid_query.status_code == 422
        assert invalid_query.json()["error"]["code"] == "request_validation_error"

    with TestClient(create_test_app(tmp_path / "schema")) as client:
        analysis_id = upload(client, b"signal;GB_flag\n1;0\n9;1\n")
        failed = wait_until_finished(client, analysis_id)
        assert failed["status"] == "failed"
        assert failed["stage"] == "schema_rejected"
        assert any("critical" in error.lower() for error in failed["errors"])
        summary = client.get(f"/api/analyses/{analysis_id}/summary")
        assert summary.status_code == 422
        assert summary.json()["error"]["details"] == failed["errors"]


@pytest.mark.parametrize(
    ("filename", "content", "expected_format", "expected_stage"),
    [
        ("month.json", b'[{"amount": 1}]', "json", "analysis_pending"),
        ("month.jsonl", b'{"amount": 1}\n', "jsonl", "analysis_pending"),
        ("month.ndjson", b'{"amount": 1}\n', "ndjson", "analysis_pending"),
        (
            "month.sql",
            b"CREATE TABLE tx (id INT); INSERT INTO tx VALUES (1);",
            "sql_dump",
            "analysis_pending",
        ),
        ("month.bson", b"\x05\x00\x00\x00\x00", "bson", "analysis_pending"),
    ],
)
def test_accepts_agreed_source_signatures_before_adapter_stage(
    tmp_path: Path,
    filename: str,
    content: bytes,
    expected_format: str,
    expected_stage: str,
) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        response = client.post(
            "/api/analyses",
            files={"file": (filename, content, "application/octet-stream")},
        )
        assert response.status_code == 202, response.text
        assert response.json()["source_format"] == expected_format

        result = wait_until_finished(client, response.json()["analysis_id"])
        assert result["status"] == "failed"
        assert result["stage"] == expected_stage
        assert result["source_format"] == expected_format
        assert result["received_bytes"] == len(content)
        job = client.app.state.analysis_manager.get_job(
            response.json()["analysis_id"]
        )
        if expected_stage == "analysis_pending":
            assert job.inventory is not None
            assert job.mapping is not None
            assert job.plan is not None
            assert sum(
                dataset.row_count for dataset in job.inventory.datasets
            ) <= 1
        else:
            assert job.inventory is None
        assert not list((tmp_path / "sessions" / "_incoming").iterdir())


def test_accepts_valid_sqlite_before_mapping_stage(tmp_path: Path) -> None:
    database = tmp_path / "fixture.sqlite"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE tx (id INTEGER PRIMARY KEY, amount REAL)")
        connection.execute("INSERT INTO tx VALUES (1, 25.5)")

    with TestClient(create_test_app(tmp_path / "app")) as client:
        response = client.post(
            "/api/analyses",
            files={
                "file": (
                    "month.sqlite",
                    database.read_bytes(),
                    "application/vnd.sqlite3",
                )
            },
        )
        assert response.status_code == 202, response.text
        result = wait_until_finished(client, response.json()["analysis_id"])
        assert result["status"] == "failed"
        assert result["stage"] == "analysis_pending"
        job = client.app.state.analysis_manager.get_job(response.json()["analysis_id"])
        assert job.inventory is not None
        assert job.mapping is not None
        assert job.plan is not None
        assert job.inventory.datasets[0].row_count == 1


def test_rejects_signature_mismatch_before_creating_job(tmp_path: Path) -> None:
    with TestClient(create_test_app(tmp_path)) as client:
        response = client.post(
            "/api/analyses",
            files={"file": ("fake.sqlite", b"not sqlite", "application/octet-stream")},
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_file_signature"
        assert not client.app.state.analysis_manager.jobs
        assert not list((tmp_path / "sessions" / "_incoming").iterdir())


def test_record_limit_fails_safely_and_removes_staged_file(tmp_path: Path) -> None:
    with TestClient(create_test_app(tmp_path, max_records=2)) as client:
        analysis_id = upload(client, csv_bytes())
        result = wait_until_finished(client, analysis_id)
        assert result["status"] == "failed"
        assert result["stage"] == "input_limit_exceeded"
        assert "2" in result["errors"][0]
        assert not list((tmp_path / "sessions" / "_incoming").iterdir())


def test_cancel_running_analysis_removes_staged_file_and_partial_session(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from app.api import routes

    entered = threading.Event()
    release = threading.Event()
    original_read_csv = routes.read_csv

    def blocking_read_csv(path):
        entered.set()
        assert release.wait(timeout=5)
        return original_read_csv(path)

    monkeypatch.setattr(routes, "read_csv", blocking_read_csv)
    with TestClient(create_test_app(tmp_path)) as client:
        analysis_id = upload(client, csv_bytes())
        assert entered.wait(timeout=5)
        response = client.post(f"/api/analyses/{analysis_id}/cancel")
        assert response.status_code == 202
        assert response.json()["status"] == "cancel_requested"
        release.set()

        result = wait_until_finished(client, analysis_id)
        assert result["status"] == "cancelled"
        assert result["stage"] == "cancelled"
        assert result["can_cancel"] is False
        assert not (tmp_path / "sessions" / analysis_id).exists()
        assert not list((tmp_path / "sessions" / "_incoming").iterdir())


def test_startup_cleanup_and_missing_model_status(tmp_path: Path) -> None:
    store = SessionStore(tmp_path / "sessions")
    old_session = store.create_session(
        [
            {
                "record_id": "old",
                "risk_probability": 0.9,
                "risk_level": "critical",
                "requires_review": True,
                "explanation_factors": [],
                "analysis_warnings": [],
            }
        ],
        threshold=0.5,
    )
    assert (store.root / old_session).exists()
    stale_upload = store.root / "_incoming" / "72b43db0-1cc1-4144-b16f-b3c1dd58fb0e"
    stale_upload.mkdir(parents=True)
    (stale_upload / "source.csv").write_bytes(b"id\n1\n")

    app = create_test_app(tmp_path)
    with TestClient(app):
        assert not (store.root / old_session).exists()
        assert not stale_upload.exists()

    unavailable = create_app(
        artifact_dir=tmp_path / "missing-artifacts",
        session_dir=tmp_path / "unavailable-sessions",
        model_registry_dir=tmp_path / "unavailable-registry",
    )
    with TestClient(unavailable) as client:
        assert client.get("/api/health").json()["status"] == "degraded"
        assert client.get("/api/model").json()["ready"] is False
        response = client.post(
            "/api/analyses",
            files={"file": ("sample.csv", csv_bytes(), "text/csv")},
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "model_unavailable"
