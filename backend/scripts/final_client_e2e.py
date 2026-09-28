"""Run the real client-risk CSV through the local FastAPI application."""

from __future__ import annotations

import argparse
import json
import tempfile
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = _arguments()
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="risk-ledger-d018-") as directory:
        root = Path(directory)
        app = create_app(
            artifact_dir=args.artifacts,
            session_dir=root / "sessions",
            model_registry_dir=root / "registry",
            transaction_artifact_dir=None,
        )
        with TestClient(app) as client, args.input.open("rb") as source:
            created = client.post(
                "/api/analyses",
                files={"file": (args.input.name, source, "text/csv")},
            )
            created.raise_for_status()
            analysis_id = created.json()["analysis_id"]
            for _ in range(7_200):
                status = client.get(f"/api/analyses/{analysis_id}/status").json()
                if status["status"] in {"completed", "failed", "cancelled"}:
                    break
                time.sleep(0.05)
            else:
                raise RuntimeError("Real CSV analysis timed out.")
            if status["status"] != "completed":
                raise RuntimeError(json.dumps(status, ensure_ascii=False))

            summary = client.get(f"/api/analyses/{analysis_id}/summary").json()
            page = client.get(
                f"/api/analyses/{analysis_id}/results",
                params={"page": 1, "page_size": 20},
            ).json()
            probabilities = [item["risk_probability"] for item in page["items"]]
            export_bytes = 0
            with client.stream(
                "GET",
                f"/api/analyses/{analysis_id}/report.csv",
                params={"requires_review": True},
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes():
                    export_bytes += len(chunk)

            result = {
                "status": status["status"],
                "rows": summary["summary"]["rows"],
                "requires_review": summary["summary"]["requires_review"],
                "model_version": summary["model_version"],
                "roc_auc": summary["metrics"].get("roc_auc"),
                "pr_auc": summary["metrics"].get("pr_auc"),
                "warnings": len(summary["summary"].get("warnings", [])),
                "first_probability": probabilities[0],
                "first_page_sorted": probabilities == sorted(probabilities, reverse=True),
                "review_export_bytes": export_bytes,
                "elapsed_seconds": round(time.perf_counter() - started, 3),
            }
            assert client.delete(f"/api/analyses/{analysis_id}").status_code == 204
            print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
