
import json

from flask import Blueprint, jsonify, request

from service import get_classified_customers


customers_bp = Blueprint("customers", __name__)


@customers_bp.get("/api/customers")
def customers():
    df = get_classified_customers()

    customer_id = request.args.get("customer_id", "").strip()
    city = request.args.get("city", "").strip()
    severity = request.args.get("severity", "").strip()
    profile = request.args.get("profile", "").strip()
    sort = request.args.get("sort", "priority_desc")

    if sort not in ("priority_desc", "priority_asc"):
        return {"error": "Invalid sort option"}, 400

    if customer_id:
        df = df[
            df["customer_id"].str.contains(
                customer_id,
                case=False,
                regex=False,
                na=False
            )
        ]

    if city:
        df = df[df["city"] == city]

    if severity:
        df = df[df["Severity"] == severity]

    if profile:
        df = df[df["profile"] == profile]

    df = df.sort_values(
        "Priority_Score",
        ascending=(sort == "priority_asc"),
        na_position="last"
    )

    df = df.copy()

    df["timestamp"] = df["timestamp"].dt.strftime(
        "%Y-%m-%dT%H:%M:%S"
    )

    # to_json turns NaN into null, so invalid rows stay valid JSON
    records = json.loads(
        df.to_json(orient="records")
    )

    return jsonify(records)
