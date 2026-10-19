
from flask import Blueprint

from service import get_classified_customers


regions_bp = Blueprint("regions", __name__)


@regions_bp.get("/api/regions")
def regions():
    df = get_classified_customers()

    results = []

    for city, customers in df.groupby("city"):
        valid_scores = customers["Priority_Score"].dropna()

        average_score = (
            round(float(valid_scores.mean()), 2)
            if not valid_scores.empty
            else None
        )

        results.append({
            "city": city,
            "total_customers": int(len(customers)),
            "normal": int(
                (customers["Severity"] == "Normal").sum()
            ),
            "monitor": int(
                (customers["Severity"] == "Monitor").sum()
            ),
            "severe": int(
                (customers["Severity"] == "Severe").sum()
            ),
            "invalid": int(
                (customers["Severity"] == "Invalid").sum()
            ),
            "average_priority_score": average_score
        })

    return {"regions": results}
