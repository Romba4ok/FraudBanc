"""Run real local source files through planning, scoring and cleanup.

The script uses the production artifacts but stores sessions, feedback and the
model registry in a temporary directory. Source files are opened read-only and
are never modified.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


TERMINAL_PLAN_STATES = {"planned", "failed", "cancelled"}
TERMINAL_RUN_STATES = {"completed", "failed", "cancelled"}


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smoke-test real Risk Ledger data sources with production models."
    )
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--client-artifacts", type=Path, required=True)
    parser.add_argument("--transaction-artifacts", type=Path, required=True)
    parser.add_argument("--timeout", type=float, default=420.0)
    return parser.parse_args()


def _wait(
    client: TestClient,
    analysis_id: str,
    terminal_states: set[str],
    timeout: float,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = client.get(f"/api/analyses/{analysis_id}/status")
        response.raise_for_status()
        payload = response.json()
        if payload["status"] in terminal_states:
            return payload
        time.sleep(0.05)
    raise TimeoutError(f"Analysis {analysis_id} did not finish within {timeout:.0f}s.")


def _smoke_file(client: TestClient, source_path: Path, timeout: float) -> dict[str, Any]:
    started = time.perf_counter()
    with source_path.open("rb") as source:
        created = client.post(
            "/api/analyses",
            params={"auto_run": False},
            files={"file": (source_path.name, source, "application/octet-stream")},
        )
    created.raise_for_status()
    created_payload = created.json()
    analysis_id = created_payload["analysis_id"]

    try:
        planned = _wait(client, analysis_id, TERMINAL_PLAN_STATES, timeout)
        if planned["status"] != "planned":
            raise RuntimeError(json.dumps(planned, ensure_ascii=False))

        inventory_response = client.get(f"/api/analyses/{analysis_id}/inventory")
        plan_response = client.get(f"/api/analyses/{analysis_id}/plan")
        inventory_response.raise_for_status()
        plan_response.raise_for_status()
        inventory = inventory_response.json()
        plan = plan_response.json()

        run_response = client.post(f"/api/analyses/{analysis_id}/run")
        run_response.raise_for_status()
        finished = _wait(client, analysis_id, TERMINAL_RUN_STATES, timeout)
        if finished["status"] != "completed":
            raise RuntimeError(json.dumps(finished, ensure_ascii=False))

        summary_response = client.get(f"/api/analyses/{analysis_id}/summary")
        summary_response.raise_for_status()
        summary = summary_response.json()

        page_totals: dict[str, int] = {}
        for route in ("clients", "transactions", "relationships"):
            response = client.get(
                f"/api/analyses/{analysis_id}/{route}",
                params={"page": 1, "page_size": 5},
            )
            response.raise_for_status()
            page_totals[route] = int(response.json()["total"])

        exported = client.get(f"/api/analyses/{analysis_id}/exports/full")
        exported.raise_for_status()

        return {
            "file": source_path.name,
            "bytes": source_path.stat().st_size,
            "source_format": created_payload["source_format"],
            "datasets": [
                {"name": item["dataset_id"], "rows": item["row_count"]}
                for item in inventory["datasets"]
            ],
            "profiles": [
                {"profile": item["profile"], "state": item["state"]}
                for item in plan["profiles"]
            ],
            "status": finished["status"],
            "rows": summary["summary"]["rows"],
            "requires_review": summary["summary"]["requires_review"],
            "pages": page_totals,
            "export_bytes": len(exported.content),
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        }
    finally:
        deleted = client.delete(f"/api/analyses/{analysis_id}")
        if deleted.status_code not in {204, 404}:
            deleted.raise_for_status()


def main() -> None:
    args = _arguments()
    inputs = [path.resolve(strict=True) for path in args.inputs]
    with tempfile.TemporaryDirectory(prefix="risk-ledger-r010-") as directory:
        temporary_root = Path(directory)
        app = create_app(
            artifact_dir=args.client_artifacts.resolve(strict=True),
            transaction_artifact_dir=args.transaction_artifacts.resolve(strict=True),
            dictionary_path=None,
            session_dir=temporary_root / "sessions",
            model_registry_dir=temporary_root / "registry",
        )
        with TestClient(app) as client:
            results = [_smoke_file(client, path, args.timeout) for path in inputs]
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
