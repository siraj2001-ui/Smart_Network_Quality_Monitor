"""Data loading, validation and cleaning.

Owner: Mohammed Al-Warfali.

Public functions (used by service.py):
    load_measurements(path) -> (clean_df, report)
    latest_per_customer(df)  -> DataFrame with one row per customer
"""
from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS = [
    "customer_id",
    "timestamp",
    "latency_ms",
    "throughput_mbps",
    "packet_loss_pct",
    "congestion_pct",
    "city",
    "profile",
]
NUMERIC_COLUMNS = ["latency_ms", "throughput_mbps", "packet_loss_pct", "congestion_pct"]

# Values outside these ranges are treated as invalid (set to NaN).
VALID_RANGES = {
    "latency_ms": (0, 10_000),
    "throughput_mbps": (0, 10_000),
    "packet_loss_pct": (0, 100),
    "congestion_pct": (0, 100),
}


class DataValidationError(Exception):
    """Raised when the CSV cannot be used at all (e.g. missing columns)."""


def validate_columns(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise DataValidationError(f"Missing required columns: {', '.join(missing)}")


def clean(df: pd.DataFrame):
    """Clean a raw measurements DataFrame. Returns (clean_df, report)."""
    validate_columns(df)
    df = df[REQUIRED_COLUMNS].copy()
    report = {"rows_read": len(df)}

    # Text columns: strip whitespace, empty -> NA
    for col in ["customer_id", "city", "profile"]:
        df[col] = df[col].astype("string").str.strip().replace("", pd.NA)

    # Timestamp -> datetime (bad values become NaT)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    # Rows we cannot use at all: no customer or no valid timestamp
    unusable = df["customer_id"].isna() | df["timestamp"].isna()
    report["rows_dropped_unusable"] = int(unusable.sum())
    df = df[~unusable]

    # Numeric columns: coerce, then null out unreasonable values
    invalid_values = 0
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        low, high = VALID_RANGES[col]
        bad = df[col].notna() & ~df[col].between(low, high)
        invalid_values += int(bad.sum())
        df.loc[bad, col] = float("nan")
    report["invalid_values_nulled"] = invalid_values
    report["rows_with_missing_metrics"] = int(df[NUMERIC_COLUMNS].isna().any(axis=1).sum())

    # Duplicates on (customer, timestamp): keep the last one in the file
    before = len(df)
    df = df.drop_duplicates(subset=["customer_id", "timestamp"], keep="last")
    report["duplicates_removed"] = before - len(df)

    # Chronological order
    df = df.sort_values(["timestamp", "customer_id"]).reset_index(drop=True)
    report["rows_after_cleaning"] = len(df)
    return df, report


def latest_per_customer(df: pd.DataFrame) -> pd.DataFrame:
    """One row per customer: their most recent measurement."""
    return (
        df.sort_values("timestamp")
        .groupby("customer_id", as_index=False, sort=True)
        .tail(1)
        .sort_values("customer_id")
        .reset_index(drop=True)
    )


def load_measurements(path):
    path = Path(path)
    if not path.exists():
        raise DataValidationError(f"Dataset not found: {path}")
    raw = pd.read_csv(path)
    return clean(raw)
