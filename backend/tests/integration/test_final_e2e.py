from __future__ import annotations

import struct
import time
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.preprocessing import build_manifest


class _FixtureModel:
    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        probability = np.full(len(features), 0.25, dtype="float64")
        return np.column_stack([1 - probability, probability])

    def get_feature_importance(self, pool, type: str) -> np.ndarray:  # noqa: A002
        assert type == "ShapValues"
        return np.zeros((pool.num_row(), pool.num_col() + 1), dtype="float64")


def _manifest():
    frame = pd.DataFrame(
        {
            "signal": [1, 2],
            "amount": [10, 20],
            "term": [3, 6],
            "income": [100, 200],
            "age": [30, 40],
            "GENDER": ["515", "516"],
            "GB_flag": [0, 1],
        }
    )
    manifest = build_manifest(frame)
    manifest.model_version = "d018-fixture"
    return manifest


def _wait_for_plan(client: TestClient, analysis_id: str) -> dict:
    for _ in range(500):
        payload = client.get(f"/api/analyses/{analysis_id}/status").json()
        if payload["status"] in {"planned", "failed", "cancelled"}:
            return payload
        time.sleep(0.01)
    raise AssertionError("Fixture did not reach a terminal planning state.")


def _sqlite_fixture(path: Path) -> bytes:
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE records (id INTEGER, amount REAL)")
        connection.execute("INSERT INTO records VALUES (1, 25.5)")
    return path.read_bytes()


def _bson_fixture() -> bytes:
    payload = b"\x10id\x00" + struct.pack("<i", 1)
    return struct.pack("<i", len(payload) + 5) + payload + b"\x00"


def test_every_supported_extension_reaches_a_human_readable_plan(tmp_path: Path) -> None:
    sqlite_payload = _sqlite_fixture(tmp_path / "fixture.sqlite")
    fixtures = (
        ("records.csv", b"id,amount\n1,25.5\n", "csv"),
        ("records.json", b'[{"id":1,"amount":25.5}]', "json"),
        ("records.jsonl", b'{"id":1,"amount":25.5}\n', "jsonl"),
        ("records.ndjson", b'{"id":1,"amount":25.5}\n', "ndjson"),
        (
            "records.sql",
            b"CREATE TABLE records (id INT, amount REAL);"
            b"INSERT INTO records VALUES (1, 25.5);",
            "sql_dump",
        ),
        ("records.sqlite", sqlite_payload, "sqlite"),
        ("records.sqlite3", sqlite_payload, "sqlite"),
        ("records.db", sqlite_payload, "sqlite"),
        ("records.bson", _bson_fixture(), "bson"),
    )
    app = create_app(
        model=_FixtureModel(),
        manifest=_manifest(),
        session_dir=tmp_path / "sessions",
        dictionary_path=None,
        transaction_artifact_dir=None,
    )

    with TestClient(app) as client:
        for filename, content, source_format in fixtures:
            created = client.post(
                "/api/analyses",
                params={"auto_run": False},
                files={"file": (filename, content, "application/octet-stream")},
            )
            assert created.status_code == 202, (filename, created.text)
            assert created.json()["source_format"] == source_format
            analysis_id = created.json()["analysis_id"]
            status = _wait_for_plan(client, analysis_id)
            assert status["status"] == "planned", (filename, status)

            inventory = client.get(f"/api/analyses/{analysis_id}/inventory")
            plan = client.get(f"/api/analyses/{analysis_id}/plan")
            assert inventory.status_code == plan.status_code == 200
            assert sum(item["row_count"] for item in inventory.json()["datasets"]) == 1
            assert "profiles" in plan.json()

            assert client.post(f"/api/analyses/{analysis_id}/cancel").status_code == 202
            assert client.delete(f"/api/analyses/{analysis_id}").status_code == 204

        assert not list((tmp_path / "sessions" / "_incoming").iterdir())
