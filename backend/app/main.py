from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import hmac
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from app import __version__
from app.api.routes import AnalysisManager, ApiError, router
from app.core.config import (
    DEFAULT_ARTIFACT_DIR,
    DEFAULT_DICTIONARY_PATH,
    DEFAULT_MODEL_REGISTRY_DIR,
    DEFAULT_SESSION_DIR,
    DEFAULT_TRANSACTION_ARTIFACT_DIR,
    MAX_INPUT_BYTES,
    MAX_INPUT_RECORDS,
)
from app.core.model_loader import load_artifacts
from app.domain.models import ModelManifest
from app.services.model_registry import ModelRegistry
from app.services.semantic_dictionary import SemanticDictionary
from app.services.session_store import SessionStore
from app.services.source_upload import cleanup_staging_root
from app.services.transaction_model import load_transaction_artifacts


def create_app(
    *,
    model: Any | None = None,
    manifest: ModelManifest | None = None,
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    session_store: SessionStore | None = None,
    session_dir: str | Path = DEFAULT_SESSION_DIR,
    max_input_bytes: int = MAX_INPUT_BYTES,
    max_input_records: int = MAX_INPUT_RECORDS,
    dictionary_path: str | Path | None = DEFAULT_DICTIONARY_PATH,
    transaction_artifact_dir: str | Path | None = DEFAULT_TRANSACTION_ARTIFACT_DIR,
    model_registry_dir: str | Path = DEFAULT_MODEL_REGISTRY_DIR,
    static_dir: str | Path | None = None,
    demo_password: str | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        store = session_store or SessionStore(session_dir)
        store.cleanup_all()
        incoming_dir = store.root / "_incoming"
        incoming_dir.mkdir(parents=True, exist_ok=True)
        cleanup_staging_root(incoming_dir)

        loaded_model = model
        loaded_manifest = manifest
        registry = ModelRegistry(
            model_registry_dir if model is None else store.root / "_model-registry",
            candidate_root=Path(artifact_dir).resolve().parent,
        )
        client_artifact_dir = Path(artifact_dir)
        active_transaction_dir = (
            Path(transaction_artifact_dir) if transaction_artifact_dir is not None else None
        )
        try:
            if (loaded_model is None) != (loaded_manifest is None):
                raise ValueError("Model and manifest must be provided together.")
            if loaded_model is None:
                client_champion = registry.champion("client_risk")
                if client_champion is not None:
                    client_artifact_dir = Path(
                        registry.get_version("client_risk", client_champion["version"])["artifact_path"]
                    )
                loaded_model, loaded_manifest = load_artifacts(client_artifact_dir)
                transaction_champion = registry.champion("transaction_anomaly")
                if transaction_champion is not None:
                    active_transaction_dir = Path(
                        registry.get_version("transaction_anomaly", transaction_champion["version"])["artifact_path"]
                    )
            app.state.analysis_manager = AnalysisManager(
                loaded_model,
                loaded_manifest,
                store,
                incoming_dir,
                max_input_records=max_input_records,
                semantic_dictionary=SemanticDictionary(dictionary_path),
                transaction_artifact_dir=active_transaction_dir,
            )
            app.state.model_registry = registry
            if model is None:
                registry.bootstrap_champion(
                    "client_risk", loaded_manifest.model_version, client_artifact_dir
                )
                if active_transaction_dir is not None and active_transaction_dir.is_dir():
                    _, transaction_manifest = load_transaction_artifacts(active_transaction_dir)
                    registry.bootstrap_champion(
                        "transaction_anomaly",
                        str(transaction_manifest["model_version"]),
                        active_transaction_dir,
                    )
            app.state.model_error = None
        except Exception as error:
            app.state.analysis_manager = None
            app.state.model_registry = registry
            app.state.model_error = str(error)

        app.state.max_input_bytes = int(max_input_bytes)
        app.state.max_input_records = int(max_input_records)
        yield

        manager = app.state.analysis_manager
        if manager is not None and manager.tasks:
            await asyncio.gather(*tuple(manager.tasks), return_exceptions=True)

    app = FastAPI(
        title="Local Fraud Risk API",
        version=__version__,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)

    active_static_dir = static_dir or os.getenv("RISK_LEDGER_STATIC_DIR")
    static_root = Path(active_static_dir).resolve() if active_static_dir else None
    active_demo_password = demo_password or os.getenv("RISK_LEDGER_DEMO_PASSWORD")

    if active_demo_password:
        expected_token = base64.b64encode(
            f"analyst:{active_demo_password}".encode("utf-8")
        ).decode("ascii")

        @app.middleware("http")
        async def demo_basic_auth(request: Request, call_next):
            if request.url.path == "/api/health":
                return await call_next(request)
            supplied = request.headers.get("Authorization", "")
            expected = f"Basic {expected_token}"
            if not hmac.compare_digest(supplied, expected):
                return Response(
                    status_code=401,
                    headers={"WWW-Authenticate": 'Basic realm="Risk Ledger Demo"'},
                )
            return await call_next(request)

    @app.middleware("http")
    async def local_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; sandbox"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; connect-src 'self'; img-src 'self' data:; "
                "style-src 'self'; script-src 'self'; font-src 'self'; "
                "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
            )
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, error: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "details": error.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        _: Request, error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "request_validation_error",
                    "message": "Request parameters are invalid.",
                    "details": [
                        ".".join(str(part) for part in item["loc"]) + ": " + item["msg"]
                        for item in error.errors()
                    ],
                }
            },
        )

    if static_root is not None and (static_root / "index.html").is_file():

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str) -> FileResponse:
            candidate = (static_root / full_path).resolve()
            inside_static = candidate == static_root or static_root in candidate.parents
            if inside_static and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(static_root / "index.html")

    return app


app = create_app()
