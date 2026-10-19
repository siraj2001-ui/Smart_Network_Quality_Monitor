
from pathlib import Path

import pandas as pd

from quality_rules import (
    calculate_priority,
    classify_customer,
    generate_reasons
)


DATA_FILE = Path(__file__).resolve().parent / "network_metrics_cleanedd.csv"


def load_measurements():
    df = pd.read_csv(DATA_FILE)
    return df


def get_previous_measurements():
    df = load_measurements()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values("timestamp")

    return df.groupby("customer_id").nth(-2)


def get_latest_measurements():
    df = load_measurements()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values("timestamp")

    latest = df.drop_duplicates(
        subset="customer_id",
        keep="last"
    )

    return latest


def get_classified_customers():
    df = get_latest_measurements()

    df["Priority_Score"] = df.apply(
        calculate_priority,
        axis=1
    )

    df["Severity"] = df.apply(
        classify_customer,
        axis=1
    )

    df["Reasons"] = df.apply(
        generate_reasons,
        axis=1
    )

    return df
