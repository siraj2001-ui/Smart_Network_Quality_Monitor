
import json

import pandas as pd
from flask import Blueprint

from service import load_measurements
from quality_rules import (
    calculate_priority,
    classify_customer,
    generate_reasons
)


history_bp = Blueprint("history", __name__)


@history_bp.get("/api/customers/<customer_id>/history")
def customer_history(customer_id):
    df = load_measurements()

    df = df[df["customer_id"] == customer_id].copy()

    if df.empty:
        return {"error": "Customer not found"}, 404

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values("timestamp")

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

    df["timestamp"] = df["timestamp"].dt.strftime(
        "%Y-%m-%dT%H:%M:%S"
    )

    records = json.loads(
        df.to_json(orient="records")
    )

    return {
        "customer_id": customer_id,
        "history": records
    }
