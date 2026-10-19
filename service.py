"""Service layer: combines data_loader + quality_rules into reusable functions.

The Flask app (app.py) only talks to this module.
"""
import os
from pathlib import Path

from data_loader import latest_per_customer, load_measurements
from quality_rules import INVALID, MONITOR, NORMAL, SEVERE, classify

DATA_PATH = Path(os.environ.get("NQM_DATA", Path(__file__).parent / "data" / "network_measurements.csv"))

_cache = {"mtime": None, "customers": None, "report": None}


def _load():
    """Load + classify, re-reading the CSV only if the file changed."""
    mtime = DATA_PATH.stat().st_mtime if DATA_PATH.exists() else None
    if _cache["customers"] is not None and _cache["mtime"] == mtime:
        return _cache["customers"]

    df, report = load_measurements(DATA_PATH)
    latest = latest_per_customer(df)

    customers = []
    for row in latest.to_dict("records"):
        result = classify(row)
        customers.append({
            "customer_id": row["customer_id"],
            "timestamp": row["timestamp"].strftime("%Y-%m-%d %H:%M"),
            "city": row["city"] if row["city"] == row["city"] else None,
            "profile": row["profile"] if row["profile"] == row["profile"] else None,
            "latency_ms": _num(row["latency_ms"]),
            "throughput_mbps": _num(row["throughput_mbps"]),
            "packet_loss_pct": _num(row["packet_loss_pct"]),
            "congestion_pct": _num(row["congestion_pct"]),
            "severity": result["severity"],
            "priority_score": result["priority_score"],
            "reasons": result["reasons"],
        })
    _cache.update(mtime=mtime, customers=customers, report=report)
    return customers


def _num(value):
    """NaN -> None so it serializes to JSON null."""
    return None if value != value else float(value)


def get_customers(city=None, severity=None, profile=None, search=None, sort=None):
    customers = _load()
    if city:
        customers = [c for c in customers if c["city"] == city]
    if severity:
        customers = [c for c in customers if c["severity"].lower() == severity.lower()]
    if profile:
        customers = [c for c in customers if c["profile"] == profile]
    if search:
        s = search.strip().lower()
        customers = [c for c in customers if s in c["customer_id"].lower()]
    if sort in ("score_desc", "score_asc"):
        reverse = sort == "score_desc"
        # Invalid customers (no score) always go last
        scored = [c for c in customers if c["priority_score"] is not None]
        unscored = [c for c in customers if c["priority_score"] is None]
        scored.sort(key=lambda c: c["priority_score"], reverse=reverse)
        customers = scored + unscored
    return customers


def get_summary():
    customers = _load()
    counts = {s: 0 for s in (NORMAL, MONITOR, SEVERE, INVALID)}
    for c in customers:
        counts[c["severity"]] += 1
    return {
        "total_customers": len(customers),
        "normal": counts[NORMAL],
        "monitor": counts[MONITOR],
        "severe": counts[SEVERE],
        "invalid": counts[INVALID],
    }


def get_options():
    customers = _load()
    return {
        "cities": sorted({c["city"] for c in customers if c["city"]}),
        "profiles": sorted({c["profile"] for c in customers if c["profile"]}),
        "severities": [NORMAL, MONITOR, SEVERE, INVALID],
    }


def get_data_report():
    _load()
    return _cache["report"]
