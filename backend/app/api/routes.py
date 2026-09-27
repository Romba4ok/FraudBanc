from __future__ import annotations

import asyncio
import logging
import sqlite3
import threading
import uuid
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from fastapi import APIRouter, File, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import MAX_INPUT_BYTES
from app.domain.models import ModelManifest
from app.services.csv_reader import CsvFormatError, read_csv
from app.services.metrics import calculate_metrics
from app.services.predictor import predict_frame
from app.services.schema_validator import validate_schema
from app.services.session_store import SessionNotFoundError, SessionStore


AnalysisStatus = Literal["queued", "validating", "predicting", "completed", "failed"]
logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_ready: bool


class ModelStatusResponse(BaseModel):
    ready: bool
    version: str | None = None
    features: int | None = None
    review_threshold: float | None = None
    error: str | None = None


class CreateAnalysisResponse(BaseModel):
    analysis_id: str
    status: Literal["queued"]
    status_url: str


class AnalysisStatusResponse(BaseModel):
    analysis_id: str
    filename: str
    status: AnalysisStatus
    progress: int
    stage: str
    warnings: list[str]
    errors: list[str]


class AnalysisSummaryResponse(BaseModel):
    analysis_id: str
    model_version: str
    threshold: float
    summary: dict[str, Any]
    metrics: dict[str, Any]


class AnalysisResultsResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    threshold: float


class ProbabilityBinResponse(BaseModel):
    from_: float = Field(alias="from")
    to: float
    count: int


class RiskDistributionResponse(BaseModel):
    analysis_id: str
    threshold: float
    risk_counts: dict[str, int]
    probability_histogram: list[ProbabilityBinResponse]


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


@dataclass(slots=True)
class AnalysisJob:
    analysis_id: str
    filename: str
    status: AnalysisStatus = "queued"
    progress: int = 0
    stage: str = "queued"
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def public_status(self) -> dict[str, Any]:
        return asdict(self)


class AnalysisManager:
    def __init__(
        self,
        model: Any,
        manifest: ModelManifest,
        store: SessionStore,
        incoming_dir: Path,
    ) -> None:
        self.model = model
        self.manifest = manifest
        self.store = store
        self.incoming_dir = incoming_dir
        self.incoming_dir.mkdir(parents=True, exist_ok=True)
        self.jobs: dict[str, AnalysisJob] = {}
        self.tasks: set[asyncio.Task[Any]] = set()
        self._lock = threading.Lock()

    def cleanup_startup(self) -> list[str]:
        deleted = self.store.cleanup_all()
        for path in self.incoming_dir.glob("*.csv"):
            path.unlink(missing_ok=True)
        return deleted

    def add_job(self, analysis_id: str, filename: str) -> AnalysisJob:
        job = AnalysisJob(analysis_id=analysis_id, filename=filename)
        with self._lock:
            self.jobs[analysis_id] = job
        return job

    def get_job(self, analysis_id: str) -> AnalysisJob:
        with self._lock:
            job = self.jobs.get(analysis_id)
        if job is None:
            raise ApiError(404, "analysis_not_found", "Analysis session was not found.")
        return job

    def _update(self, analysis_id: str, **changes: Any) -> None:
        with self._lock:
            job = self.jobs[analysis_id]
            for key, value in changes.items():
                setattr(job, key, value)

    def process(self, analysis_id: str, upload_path: Path) -> None:
        try:
            self._update(
                analysis_id, status="validating", progress=10, stage="reading_csv"
            )
            frame, _ = read_csv(upload_path)
            if frame.empty:
                raise ValueError("CSV contains no data rows.")

            validation = validate_schema(frame, self.manifest)
            self._update(analysis_id, warnings=validation.warnings)
            if not validation.is_compatible:
                self._update(
                    analysis_id,
                    status="failed",
                    progress=100,
                    stage="schema_rejected",
                    errors=validation.errors,
                )
                return

            self._update(
                analysis_id, status="predicting", progress=35, stage="inference"
            )
            prediction = predict_frame(
                frame,
                self.model,
                self.manifest,
                warnings=validation.warnings,
            )
            target = (
                frame[self.manifest.target_column]
                if validation.target_present
                else None
            )
            metrics = calculate_metrics(
                target,
                prediction.probabilities,
                prediction.threshold,
            )
            risk_counts = Counter(row["risk_level"] for row in prediction.rows)
            summary = {
                "rows": len(prediction.rows),
                "requires_review": sum(
                    bool(row["requires_review"]) for row in prediction.rows
                ),
                "risk_counts": {
                    level: risk_counts.get(level, 0)
                    for level in ("low", "medium", "high", "critical")
                },
                "warnings": validation.warnings,
                "target_present": validation.target_present,
                "target_valid": validation.target_valid,
            }
            self.store.create_session(
                prediction.rows,
                threshold=prediction.threshold,
                metrics=metrics,
                model_version=self.manifest.model_version,
                session_id=analysis_id,
                summary=summary,
            )
            self._update(
                analysis_id,
                status="completed",
                progress=100,
                stage="completed",
            )
        except (CsvFormatError, UnicodeError, ValueError) as error:
            self._update(
                analysis_id,
                status="failed",
                progress=100,
                stage="failed",
                errors=[str(error)],
            )
        except (sqlite3.OperationalError, OSError) as error:
            logger.exception("Analysis %s could not persist its results", analysis_id)
            storage_full = "full" in str(error).lower() or getattr(error, "errno", None) == 28
            self._update(
                analysis_id,
                status="failed",
                progress=100,
                stage="storage_failed",
                errors=[
                    (
                        "Недостаточно временного места для результатов. "
                        "Завершите предыдущую сессию и повторите анализ."
                        if storage_full
                        else "Не удалось сохранить временные результаты анализа."
                    )
                ],
            )
        except Exception:
            logger.exception("Unexpected failure while processing analysis %s", analysis_id)
            self._update(
                analysis_id,
                status="failed",
                progress=100,
                stage="failed",
                errors=["Внутренняя ошибка анализа. Повторите попытку."],
            )
        finally:
            upload_path.unlink(missing_ok=True)
            if self.get_job(analysis_id).status == "failed":
                try:
                    self.store.delete_session(analysis_id)
                except (SessionNotFoundError, OSError):
                    pass

    def remove(self, analysis_id: str) -> None:
        job = self.get_job(analysis_id)
        if job.status in {"queued", "validating", "predicting"}:
            raise ApiError(409, "analysis_running", "Analysis is still running.")
        try:
            self.store.delete_session(analysis_id)
        except SessionNotFoundError:
            pass
        (self.incoming_dir / f"{analysis_id}.csv").unlink(missing_ok=True)
        with self._lock:
            self.jobs.pop(analysis_id, None)


router = APIRouter(prefix="/api")


def _manager(request: Request) -> AnalysisManager:
    manager = getattr(request.app.state, "analysis_manager", None)
    if manager is None:
        raise ApiError(503, "model_unavailable", "Model artifacts are not available.")
    return manager


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> dict[str, Any]:
    ready = getattr(request.app.state, "analysis_manager", None) is not None
    return {
        "status": "ok" if ready else "degraded",
        "model_ready": ready,
    }


@router.get("/model", response_model=ModelStatusResponse)
def model_status(request: Request) -> dict[str, Any]:
    manager = getattr(request.app.state, "analysis_manager", None)
    if manager is None:
        return {
            "ready": False,
            "error": getattr(request.app.state, "model_error", "Model unavailable."),
        }
    return {
        "ready": True,
        "version": manager.manifest.model_version,
        "features": len(manager.manifest.feature_columns),
        "review_threshold": manager.manifest.review_threshold,
    }


@router.post(
    "/analyses",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=CreateAnalysisResponse,
)
async def create_analysis(
    request: Request,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    manager = _manager(request)
    filename = Path(file.filename or "").name
    if not filename.lower().endswith(".csv"):
        raise ApiError(415, "unsupported_file", "Only .csv files are supported.")

    analysis_id = str(uuid.uuid4())
    upload_path = manager.incoming_dir / f"{analysis_id}.csv"
    byte_limit = int(getattr(request.app.state, "max_input_bytes", MAX_INPUT_BYTES))
    received = 0
    try:
        with upload_path.open("wb") as stream:
            while chunk := await file.read(1024 * 1024):
                received += len(chunk)
                if received > byte_limit:
                    raise ApiError(
                        413,
                        "file_too_large",
                        f"CSV exceeds the {byte_limit}-byte upload limit.",
                    )
                stream.write(chunk)
    except Exception:
        upload_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    manager.add_job(analysis_id, filename)
    task = asyncio.create_task(asyncio.to_thread(manager.process, analysis_id, upload_path))
    manager.tasks.add(task)
    task.add_done_callback(manager.tasks.discard)
    return {
        "analysis_id": analysis_id,
        "status": "queued",
        "status_url": f"/api/analyses/{analysis_id}/status",
    }


@router.get(
    "/analyses/{analysis_id}/status",
    response_model=AnalysisStatusResponse,
)
def analysis_status(request: Request, analysis_id: str) -> dict[str, Any]:
    return _manager(request).get_job(analysis_id).public_status()


def _completed_job(manager: AnalysisManager, analysis_id: str) -> AnalysisJob:
    job = manager.get_job(analysis_id)
    if job.status == "failed":
        raise ApiError(422, "analysis_failed", "Analysis failed.", job.errors)
    if job.status != "completed":
        raise ApiError(409, "analysis_not_ready", "Analysis is not completed yet.")
    return job


@router.get(
    "/analyses/{analysis_id}/summary",
    response_model=AnalysisSummaryResponse,
)
def analysis_summary(
    request: Request,
    analysis_id: str,
    threshold: float | None = Query(default=None, ge=0, le=1),
) -> dict[str, Any]:
    manager = _manager(request)
    _completed_job(manager, analysis_id)
    metadata = manager.store.get_metadata(analysis_id)
    active_threshold = (
        float(metadata["threshold"]) if threshold is None else threshold
    )
    targets, probabilities = manager.store.metric_inputs(
        analysis_id, manager.manifest.target_column
    )
    metrics = calculate_metrics(
        None if targets is None else pd.Series(targets),
        probabilities,
        active_threshold,
    )
    summary = dict(metadata["summary"])
    summary["requires_review"] = sum(
        probability >= active_threshold for probability in probabilities
    )
    return {
        "analysis_id": analysis_id,
        "model_version": metadata["model_version"],
        "threshold": active_threshold,
        "summary": summary,
        "metrics": metrics.to_dict(),
    }


@router.get(
    "/analyses/{analysis_id}/results",
    response_model=AnalysisResultsResponse,
)
def analysis_results(
    request: Request,
    analysis_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    risk_level: str | None = Query(default=None),
    threshold: float | None = Query(default=None, ge=0, le=1),
    requires_review: bool | None = Query(default=None),
    probability_min: float | None = Query(default=None, ge=0, le=1),
    probability_max: float | None = Query(default=None, ge=0, le=1),
    record_id: str | None = Query(default=None, max_length=200),
) -> dict[str, Any]:
    manager = _manager(request)
    _completed_job(manager, analysis_id)
    try:
        result = manager.store.get_page(
            analysis_id,
            page=page,
            page_size=page_size,
            risk_filter=risk_level,
            threshold=threshold,
            requires_review=requires_review,
            probability_min=probability_min,
            probability_max=probability_max,
            record_id=record_id,
        )
    except ValueError as error:
        raise ApiError(422, "invalid_filter", str(error)) from error
    return asdict(result)


@router.get(
    "/analyses/{analysis_id}/distribution",
    response_model=RiskDistributionResponse,
)
def analysis_distribution(
    request: Request,
    analysis_id: str,
    bins: int = Query(default=10, ge=2, le=50),
    threshold: float | None = Query(default=None, ge=0, le=1),
) -> dict[str, Any]:
    manager = _manager(request)
    _completed_job(manager, analysis_id)
    try:
        distribution = manager.store.get_distribution(
            analysis_id,
            bins=bins,
            threshold=threshold,
        )
    except ValueError as error:
        raise ApiError(422, "invalid_filter", str(error)) from error
    payload = asdict(distribution)
    payload["probability_histogram"] = [
        {
            "from": item["from_value"],
            "to": item["to_value"],
            "count": item["count"],
        }
        for item in payload["probability_histogram"]
    ]
    return payload


@router.get("/analyses/{analysis_id}/report.csv")
def download_report(
    request: Request,
    analysis_id: str,
    threshold: float | None = Query(default=None, ge=0, le=1),
    requires_review: bool = Query(default=False),
) -> StreamingResponse:
    manager = _manager(request)
    _completed_job(manager, analysis_id)
    return StreamingResponse(
        manager.store.iter_csv(
            analysis_id,
            threshold=threshold,
            requires_review=requires_review,
        ),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="analysis-{analysis_id}-review.csv"'
                if requires_review
                else f'attachment; filename="analysis-{analysis_id}.csv"'
            )
        },
    )


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(request: Request, analysis_id: str) -> Response:
    _manager(request).remove(analysis_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
