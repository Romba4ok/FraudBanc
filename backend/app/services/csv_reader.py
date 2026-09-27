from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import pandas as pd


class CsvFormatError(ValueError):
    """Raised when a CSV header or delimiter is not safe to process."""


@dataclass(frozen=True, slots=True)
class CsvMetadata:
    delimiter: str
    columns: list[str]


def normalize_header(value: object) -> str:
    return str(value).strip()


def _read_sample(path: Path, size: int = 64 * 1024) -> str:
    with path.open("r", encoding="utf-8-sig", errors="strict", newline="") as stream:
        return stream.read(size)


def detect_delimiter(sample: str) -> str:
    if not sample.strip():
        raise CsvFormatError("CSV is empty.")

    first_line = sample.splitlines()[0]
    counts = {delimiter: first_line.count(delimiter) for delimiter in (";", ",")}
    if max(counts.values()) == 0:
        raise CsvFormatError("CSV delimiter must be ';' or ','.")

    try:
        detected = csv.Sniffer().sniff(sample, delimiters=";,").delimiter
    except csv.Error:
        detected = max(counts, key=counts.get)
    return detected


def inspect_csv(path: str | Path) -> CsvMetadata:
    csv_path = Path(path)
    sample = _read_sample(csv_path)
    delimiter = detect_delimiter(sample)
    first_line = sample.splitlines()[0]
    raw_columns = next(csv.reader([first_line], delimiter=delimiter))
    columns = [normalize_header(column) for column in raw_columns]

    if not columns or any(not column for column in columns):
        raise CsvFormatError("CSV contains an empty column name.")

    duplicates = sorted({column for column in columns if columns.count(column) > 1})
    if duplicates:
        raise CsvFormatError(f"CSV contains duplicate columns: {', '.join(duplicates)}")
    return CsvMetadata(delimiter=delimiter, columns=columns)


def read_csv(path: str | Path, *, nrows: int | None = None) -> tuple[pd.DataFrame, CsvMetadata]:
    csv_path = Path(path)
    metadata = inspect_csv(csv_path)
    frame = pd.read_csv(
        csv_path,
        sep=metadata.delimiter,
        dtype="string",
        encoding="utf-8-sig",
        keep_default_na=False,
        nrows=nrows,
        low_memory=False,
    )
    frame.columns = [normalize_header(column) for column in frame.columns]
    return frame, metadata


def iter_csv_chunks(path: str | Path, *, chunksize: int) -> Iterator[pd.DataFrame]:
    csv_path = Path(path)
    metadata = inspect_csv(csv_path)
    reader = pd.read_csv(
        csv_path,
        sep=metadata.delimiter,
        dtype="string",
        encoding="utf-8-sig",
        keep_default_na=False,
        chunksize=chunksize,
        low_memory=False,
    )
    for frame in reader:
        frame.columns = [normalize_header(column) for column in frame.columns]
        yield frame
