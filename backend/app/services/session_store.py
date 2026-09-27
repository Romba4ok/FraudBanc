from __future__ import annotations

import csv
import io
import json
import shutil
import sqlite3
import time
import uuid
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from app.core.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SESSION_TTL_SECONDS
from app.domain.models import AnalysisMetrics, ProbabilityBin, ResultPage, RiskDistribution


RISK_LEVELS = frozenset({"low", "medium", "high", "critical"})


class SessionNotFoundError(KeyError):
    pass


class SessionStore:
    """Ephemeral, one-SQLite-file-per-analysis result storage."""

    def __init__(self, root: str | Path, *, ttl_seconds: int = SESSION_TTL_SECONDS):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = int(ttl_seconds)

    def _session_dir(self, session_id: str) -> Path:
        try:
            normalized = str(uuid.UUID(session_id))
        except ValueError as error:
            raise SessionNotFoundError(session_id) from error
        return self.root / normalized

    def _database_path(self, session_id: str) -> Path:
        directory = self._session_dir(session_id)
        path = directory / "results.sqlite3"
        if not path.is_file():
            raise SessionNotFoundError(session_id)
        return path

    @staticmethod
    def _open_connection(
        path: Path,
        *,
        check_same_thread: bool = True,
    ) -> sqlite3.Connection:
        connection = sqlite3.connect(path, check_same_thread=check_same_thread)
        connection.row_factory = sqlite3.Row
        return connection

    @classmethod
    @contextmanager
    def _connect(cls, path: Path) -> Iterator[sqlite3.Connection]:
        connection = cls._open_connection(path)
        try:
            yield connection
        finally:
            connection.close()

    def create_session(
        self,
        rows: Iterable[dict[str, Any]],
        *,
        threshold: float,
        metrics: AnalysisMetrics | None = None,
        model_version: str = "",
        session_id: str | None = None,
        summary: dict[str, Any] | None = None,
    ) -> str:
        if not 0 <= threshold <= 1:
            raise ValueError("threshold must be between 0 and 1.")
        session_id = str(uuid.uuid4()) if session_id is None else str(uuid.UUID(session_id))
        directory = self.root / session_id
        directory.mkdir(parents=False, exist_ok=False)
        database = directory / "results.sqlite3"

        with self._connect(database) as connection:
            connection.executescript(
                """
                CREATE TABLE session_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE results (
                    row_position INTEGER PRIMARY KEY,
                    record_id TEXT NOT NULL,
                    risk_probability REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX idx_results_risk
                    ON results(risk_probability DESC, row_position ASC);
                CREATE INDEX idx_results_level_risk
                    ON results(risk_level, risk_probability DESC, row_position ASC);
                """
            )
            metadata = {
                "created_at": time.time(),
                "threshold": float(threshold),
                "model_version": model_version,
                "metrics": None if metrics is None else metrics.to_dict(),
                "summary": summary or {},
            }
            connection.executemany(
                "INSERT INTO session_metadata(key, value) VALUES (?, ?)",
                [
                    (key, json.dumps(value, ensure_ascii=False, allow_nan=False))
                    for key, value in metadata.items()
                ],
            )
            prepared = []
            for position, row in enumerate(rows):
                probability = float(row["risk_probability"])
                level = str(row["risk_level"])
                if not 0 <= probability <= 1 or level not in RISK_LEVELS:
                    raise ValueError("Invalid prediction row.")
                prepared.append(
                    (
                        position,
                        str(row["record_id"]),
                        probability,
                        level,
                        json.dumps(row, ensure_ascii=False, allow_nan=False),
                    )
                )
            connection.executemany(
                """
                INSERT INTO results(
                    row_position, record_id, risk_probability, risk_level, payload_json
                ) VALUES (?, ?, ?, ?, ?)
                """,
                prepared,
            )
            connection.commit()
        return session_id

    def metric_inputs(
        self,
        session_id: str,
        target_column: str,
    ) -> tuple[list[Any] | None, list[float]]:
        targets: list[Any] = []
        probabilities: list[float] = []
        with self._connect(self._database_path(session_id)) as connection:
            records = connection.execute(
                "SELECT payload_json FROM results ORDER BY row_position ASC"
            )
            target_present = True
            for record in records:
                item = json.loads(record["payload_json"])
                probabilities.append(float(item["risk_probability"]))
                if target_column in item:
                    targets.append(item[target_column])
                else:
                    target_present = False
        return (targets if target_present else None), probabilities

    def save_upload(self, session_id: str, content: bytes) -> Path:
        directory = self._session_dir(session_id)
        if not (directory / "results.sqlite3").is_file():
            raise SessionNotFoundError(session_id)
        path = directory / "upload.csv"
        path.write_bytes(content)
        return path

    def get_metadata(self, session_id: str) -> dict[str, Any]:
        with self._connect(self._database_path(session_id)) as connection:
            records = connection.execute(
                "SELECT key, value FROM session_metadata"
            ).fetchall()
        return {record["key"]: json.loads(record["value"]) for record in records}

    def get_page(
        self,
        session_id: str,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        risk_filter: str | None = None,
        threshold: float | None = None,
        requires_review: bool | None = None,
        probability_min: float | None = None,
        probability_max: float | None = None,
        record_id: str | None = None,
    ) -> ResultPage:
        if page < 1:
            raise ValueError("page must be at least 1.")
        if not 1 <= page_size <= MAX_PAGE_SIZE:
            raise ValueError(f"page_size must be between 1 and {MAX_PAGE_SIZE}.")
        if risk_filter is not None and risk_filter not in RISK_LEVELS:
            raise ValueError("Unknown risk level filter.")
        if probability_min is not None and not 0 <= probability_min <= 1:
            raise ValueError("probability_min must be between 0 and 1.")
        if probability_max is not None and not 0 <= probability_max <= 1:
            raise ValueError("probability_max must be between 0 and 1.")
        if (
            probability_min is not None
            and probability_max is not None
            and probability_min > probability_max
        ):
            raise ValueError("probability_min must not exceed probability_max.")

        metadata = self.get_metadata(session_id)
        active_threshold = (
            float(metadata["threshold"]) if threshold is None else float(threshold)
        )
        if not 0 <= active_threshold <= 1:
            raise ValueError("threshold must be between 0 and 1.")

        conditions: list[str] = []
        parameters: list[Any] = []
        if risk_filter:
            conditions.append("risk_level = ?")
            parameters.append(risk_filter)
        if requires_review is not None:
            conditions.append(
                "risk_probability >= ?" if requires_review else "risk_probability < ?"
            )
            parameters.append(active_threshold)
        if probability_min is not None:
            conditions.append("risk_probability >= ?")
            parameters.append(float(probability_min))
        if probability_max is not None:
            conditions.append("risk_probability <= ?")
            parameters.append(float(probability_max))
        normalized_record_id = (record_id or "").strip()
        if normalized_record_id:
            escaped_record_id = (
                normalized_record_id.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            conditions.append("LOWER(record_id) LIKE LOWER(?) ESCAPE '\\'")
            parameters.append(f"%{escaped_record_id}%")
        where = " WHERE " + " AND ".join(conditions) if conditions else ""
        with self._connect(self._database_path(session_id)) as connection:
            total = int(
                connection.execute(
                    "SELECT COUNT(*) AS total FROM results" + where,
                    parameters,
                ).fetchone()["total"]
            )
            records = connection.execute(
                "SELECT payload_json FROM results"
                + where
                + " ORDER BY risk_probability DESC, row_position ASC LIMIT ? OFFSET ?",
                [*parameters, page_size, (page - 1) * page_size],
            ).fetchall()

        items = []
        for record in records:
            item = json.loads(record["payload_json"])
            item["requires_review"] = (
                float(item["risk_probability"]) >= active_threshold
            )
            items.append(item)
        return ResultPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            threshold=active_threshold,
        )

    def get_distribution(
        self,
        session_id: str,
        *,
        bins: int = 10,
        threshold: float | None = None,
    ) -> RiskDistribution:
        if not 2 <= bins <= 50:
            raise ValueError("bins must be between 2 and 50.")
        metadata = self.get_metadata(session_id)
        active_threshold = (
            float(metadata["threshold"]) if threshold is None else float(threshold)
        )
        if not 0 <= active_threshold <= 1:
            raise ValueError("threshold must be between 0 and 1.")

        counts = {level: 0 for level in ("low", "medium", "high", "critical")}
        histogram_counts = [0] * bins
        with self._connect(self._database_path(session_id)) as connection:
            records = connection.execute(
                "SELECT risk_probability, risk_level FROM results"
            )
            for record in records:
                probability = float(record["risk_probability"])
                counts[str(record["risk_level"])] += 1
                index = min(int(probability * bins), bins - 1)
                histogram_counts[index] += 1

        histogram = [
            ProbabilityBin(
                from_value=index / bins,
                to_value=(index + 1) / bins,
                count=count,
            )
            for index, count in enumerate(histogram_counts)
        ]
        return RiskDistribution(
            analysis_id=session_id,
            threshold=active_threshold,
            risk_counts=counts,
            probability_histogram=histogram,
        )

    def iter_csv(
        self,
        session_id: str,
        *,
        threshold: float | None = None,
        requires_review: bool = False,
    ) -> Iterator[str]:
        metadata = self.get_metadata(session_id)
        active_threshold = (
            float(metadata["threshold"]) if threshold is None else float(threshold)
        )
        if not 0 <= active_threshold <= 1:
            raise ValueError("threshold must be between 0 and 1.")

        # Starlette advances sync streaming iterators in a worker pool and may
        # resume consecutive iterations on different threads. Access remains
        # sequential, so this connection can safely cross those worker threads.
        connection = self._open_connection(
            self._database_path(session_id),
            check_same_thread=False,
        )
        try:
            first = connection.execute(
                "SELECT payload_json FROM results "
                "ORDER BY risk_probability DESC, row_position ASC LIMIT 1"
            ).fetchone()
            if first is None:
                return
            first_item = json.loads(first["payload_json"])
            fieldnames = list(first_item)
            buffer = io.StringIO(newline="")
            writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

            if requires_review:
                cursor = connection.execute(
                    "SELECT payload_json FROM results "
                    "WHERE risk_probability >= ? "
                    "ORDER BY risk_probability DESC, row_position ASC",
                    (active_threshold,),
                )
            else:
                cursor = connection.execute(
                    "SELECT payload_json FROM results "
                    "ORDER BY risk_probability DESC, row_position ASC"
                )

            for record in cursor:
                item = json.loads(record["payload_json"])
                item["requires_review"] = (
                    float(item["risk_probability"]) >= active_threshold
                )
                serialized = {
                    key: (
                        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                        if isinstance(value, (dict, list))
                        else value
                    )
                    for key, value in item.items()
                }
                writer.writerow(serialized)
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate(0)
        finally:
            connection.close()

    def delete_session(self, session_id: str) -> None:
        directory = self._session_dir(session_id)
        if not directory.is_dir():
            raise SessionNotFoundError(session_id)
        if directory.parent != self.root:
            raise RuntimeError("Unsafe session path.")
        shutil.rmtree(directory)

    def cleanup_expired(self, *, now: float | None = None) -> list[str]:
        current_time = time.time() if now is None else float(now)
        deleted: list[str] = []
        for directory in self.root.iterdir():
            if not directory.is_dir():
                continue
            try:
                session_id = str(uuid.UUID(directory.name))
                metadata = self.get_metadata(session_id)
                created_at = float(metadata["created_at"])
            except (ValueError, KeyError, SessionNotFoundError, sqlite3.Error):
                continue
            if current_time - created_at > self.ttl_seconds:
                self.delete_session(session_id)
                deleted.append(session_id)
        return deleted

    def cleanup_all(self) -> list[str]:
        deleted: list[str] = []
        for directory in self.root.iterdir():
            if not directory.is_dir():
                continue
            try:
                session_id = str(uuid.UUID(directory.name))
            except ValueError:
                continue
            self.delete_session(session_id)
            deleted.append(session_id)
        return deleted
