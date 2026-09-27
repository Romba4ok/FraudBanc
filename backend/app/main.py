from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.routes import AnalysisManager, ApiError, router
from app.core.config import DEFAULT_ARTIFACT_DIR, DEFAULT_SESSION_DIR, MAX_INPUT_BYTES
from app.core.model_loader import load_artifacts
from app.domain.models import ModelManifest
from app.services.session_store import SessionStore


def create_app(
    *,
    model: Any | None = None,
    manifest: ModelManifest | None = None,
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    session_store: SessionStore | None = None,
    session_dir: str | Path = DEFAULT_SESSION_DIR,
    max_input_bytes: int = MAX_INPUT_BYTES,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        store = session_store or SessionStore(session_dir)
        store.cleanup_all()
        incoming_dir = store.root / "_incoming"
        incoming_dir.mkdir(parents=True, exist_ok=True)
        for path in incoming_dir.glob("*.csv"):
            path.unlink(missing_ok=True)

        loaded_model = model
        loaded_manifest = manifest
        try:
            if (loaded_model is None) != (loaded_manifest is None):
                raise ValueError("Model and manifest must be provided together.")
            if loaded_model is None:
                loaded_model, loaded_manifest = load_artifacts(artifact_dir)
            app.state.analysis_manager = AnalysisManager(
                loaded_model,
                loaded_manifest,
                store,
                incoming_dir,
            )
            app.state.model_error = None
        except Exception as error:
            app.state.analysis_manager = None
            app.state.model_error = str(error)

        app.state.max_input_bytes = int(max_input_bytes)
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
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)

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

    return app


app = create_app()
