from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def test_api_responses_disable_embedding_sniffing_and_storage(tmp_path: Path) -> None:
    app = create_app(
        artifact_dir=tmp_path / "missing-artifacts",
        session_dir=tmp_path / "sessions",
        model_registry_dir=tmp_path / "registry",
    )

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert "geolocation=()" in response.headers["permissions-policy"]
