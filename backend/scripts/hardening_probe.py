"""Local D017 boundary probe; generates data only in an isolated temp directory."""

from __future__ import annotations

import json
import tempfile
import time
import tracemalloc
from pathlib import Path

from app.core.config import MAX_INPUT_BYTES, MAX_INPUT_RECORDS
from app.domain.contracts import SourceFormat
from app.services.source_adapters import CsvSourceAdapter
from app.services.source_upload import validate_staged_signature


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="risk-ledger-d017-") as directory:
        root = Path(directory)
        million = root / "million.csv"
        with million.open("w", encoding="utf-8", newline="") as stream:
            stream.write("id,value\n")
            for index in range(MAX_INPUT_RECORDS):
                stream.write(f"{index},{index % 10}\n")

        tracemalloc.start()
        started = time.perf_counter()
        rows = sum(
            len(batch.records)
            for batch in CsvSourceAdapter().iter_batches(
                million,
                batch_size=5_000,
                max_records=MAX_INPUT_RECORDS,
            )
        )
        elapsed = time.perf_counter() - started
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        boundary = root / "boundary.csv"
        with boundary.open("wb") as stream:
            header = b"id,value\n"
            stream.write(header)
            remaining = MAX_INPUT_BYTES - len(header)
            block = b"1,1\n" * (1024 * 1024 // 4)
            while remaining:
                payload = block[: min(len(block), remaining)]
                stream.write(payload)
                remaining -= len(payload)
        validate_staged_signature(boundary, SourceFormat.CSV)

        print(
            json.dumps(
                {
                    "records": rows,
                    "record_limit": MAX_INPUT_RECORDS,
                    "csv_bytes": million.stat().st_size,
                    "elapsed_seconds": round(elapsed, 3),
                    "python_peak_bytes": peak,
                    "boundary_file_bytes": boundary.stat().st_size,
                    "byte_limit": MAX_INPUT_BYTES,
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
