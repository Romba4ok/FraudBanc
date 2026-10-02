from __future__ import annotations

import base64
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def authorization(password: str) -> dict[str, str]:
    token = base64.b64encode(f"analyst:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def test_cloud_shell_serves_spa_and_protects_demo(tmp_path: Path) -> None:
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<main>Risk Ledger</main>", encoding="utf-8")
    (static / "app.js").write_text("console.log('ready')", encoding="utf-8")

    app = create_app(
        artifact_dir=tmp_path / "missing-artifacts",
        session_dir=tmp_path / "sessions",
        model_registry_dir=tmp_path / "registry",
        transaction_artifact_dir=None,
        dictionary_path=None,
        static_dir=static,
        demo_password="demo-secret",
    )

    with TestClient(app) as client:
        assert client.get("/").status_code == 401
        assert client.get("/api/health").status_code == 200

        headers = authorization("demo-secret")
        root = client.get("/", headers=headers)
        assert root.status_code == 200
        assert "Risk Ledger" in root.text
        assert "default-src 'self'" in root.headers["content-security-policy"]

        asset = client.get("/app.js", headers=headers)
        assert asset.status_code == 200
        assert "ready" in asset.text

        fallback = client.get("/overview", headers=headers)
        assert fallback.status_code == 200
        assert "Risk Ledger" in fallback.text
