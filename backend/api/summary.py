
import pandas as pd
from flask import Blueprint

from service import get_classified_customers, get_previous_measurements
from quality_rules import calculate_priority


summary_bp = Blueprint("summary", __name__)


def _average(series):
    value = pd.to_numeric(series, errors="coerce").mean()

    if pd.isna(value):
        return None

    return round(float(value), 2)


def _previous_average_priority():
    previous = get_previous_measurements()

    if previous.empty:
        return None

    return _average(previous.apply(calculate_priority, axis=1))


@summary_bp.get("/api/summary")
def summary():
    df = get_classified_customers()

    return {
        "total_customers": int(len(df)),
        "normal": int((df["Severity"] == "Normal").sum()),
        "monitor": int((df["Severity"] == "Monitor").sum()),
        "severe": int((df["Severity"] == "Severe").sum()),
        "invalid": int((df["Severity"] == "Invalid").sum()),

        "average_latency_ms": _average(df["latency_ms"]),
        "average_throughput_mbps": _average(df["throughput_mbps"]),
        "average_packet_loss_pct": _average(df["packet_loss_pct"]),
        "average_congestion_pct": _average(df["congestion_pct"]),

        "average_priority_score": _average(df["Priority_Score"]),
        "previous_average_priority_score": _previous_average_priority(),

        "last_data_updated": (
            df["timestamp"].max().isoformat()
        )
    }
