
from flask import Blueprint

from service import get_classified_customers


summary_bp = Blueprint("summary", __name__)


@summary_bp.get("/api/summary")
def summary():
    df = get_classified_customers()

    return {
        "total_customers": int(len(df)),
        "normal": int((df["Severity"] == "Normal").sum()),
        "monitor": int((df["Severity"] == "Monitor").sum()),
        "severe": int((df["Severity"] == "Severe").sum()),
        "invalid": int((df["Severity"] == "Invalid").sum()),

        "average_latency_ms": round(
            float(df["latency_ms"].mean()), 2
        ),
        "average_throughput_mbps": round(
            float(df["throughput_mbps"].mean()), 2
        ),
        "average_packet_loss_pct": round(
            float(df["packet_loss_pct"].mean()), 2
        ),
        "average_congestion_pct": round(
            float(df["congestion_pct"].mean()), 2
        ),

        "last_data_updated": (
            df["timestamp"].max().isoformat()
        )
    }
