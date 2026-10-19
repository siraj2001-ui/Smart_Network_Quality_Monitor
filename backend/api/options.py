
from flask import Blueprint

from service import get_classified_customers


options_bp = Blueprint("options", __name__)


@options_bp.get("/api/options")
def options():
    df = get_classified_customers()

    return {
        "cities": sorted(df["city"].dropna().unique().tolist()),
        "profiles": sorted(df["profile"].dropna().unique().tolist()),
        "severities": [
            "Normal",
            "Monitor",
            "Severe",
            "Invalid"
        ]
    }
