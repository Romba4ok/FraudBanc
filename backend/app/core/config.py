from __future__ import annotations

from pathlib import Path
import tempfile
import os


TARGET_COLUMN = "GB_flag"
MODEL_VERSION = "2.0.0"
DEFAULT_RANDOM_SEED = 42
DEFAULT_TEST_SIZE = 0.30
DEFAULT_ITERATIONS = 300

MAX_INPUT_BYTES = int(os.getenv("RISK_LEDGER_MAX_INPUT_BYTES", str(500 * 1024 * 1024)))
MAX_INPUT_RECORDS = int(os.getenv("RISK_LEDGER_MAX_INPUT_RECORDS", "1000000"))
CHUNK_SIZE = 5_000
PREDICTION_BATCH_SIZE = 2_000
SHAP_FACTOR_COUNT = 5
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500
SESSION_TTL_SECONDS = 24 * 60 * 60
MAX_OPTIONAL_MISSING_RATIO = 0.20
DRIFT_MISSING_RATE_DELTA = 0.20
MISSING_CATEGORY = "__MISSING__"
UNKNOWN_CATEGORY = "__UNKNOWN__"

MISSING_TOKENS = frozenset({"", "-", "–", "—", "nan", "none", "null", "n/a"})

CATEGORICAL_FEATURES = frozenset(
    {
        "was_canceled",
        "GENDER",
        "CLASSIFICATION",
        "RESIDENCY",
        "EDUCATION",
        "MARITALSTATUS",
        "NEGATIVESTATUS",
        "PROFESSION",
        "ECONOMYACTIVITYGROUP",
        "EMPLOYMENTNATURE",
    }
)

IDENTIFIER_COLUMNS = frozenset(
    {
        "record_id",
        "client_id",
        "account_id",
        "customer_id",
        "subject_id",
        "iin",
    }
)

ZERO_MISSING_PREFIXES = (
    "NUM_",
    "CNT_",
    "MONTH_OVERDUE_C",
    "MONTH_OVERDUE_A",
)
ZERO_MISSING_COLUMNS = frozenset(
    {
        "overdueinstalmentcount_po_subektu",
        "loans",
        "frequency",
    }
)

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "current"
DEFAULT_TRANSACTION_ARTIFACT_DIR = (
    Path(__file__).resolve().parents[2] / "artifacts" / "transaction" / "current"
)
DEFAULT_DICTIONARY_PATH = (
    Path(__file__).resolve().parents[2] / "artifacts" / "semantic_dictionary.json"
)
DEFAULT_SESSION_DIR = Path(
    os.getenv("RISK_LEDGER_SESSION_DIR", str(Path(tempfile.gettempdir()) / "bank-fraud-local-sessions"))
)
DEFAULT_MODEL_REGISTRY_DIR = Path(
    os.getenv("RISK_LEDGER_MODEL_REGISTRY_DIR", str(Path(tempfile.gettempdir()) / "bank-fraud-model-registry"))
)
