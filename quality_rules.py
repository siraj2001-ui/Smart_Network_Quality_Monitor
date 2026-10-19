"""Severity classification and priority scoring.

Owner: Aya Al-Shaikhi.

Scoring (per the training guide):
    metric beyond its monitor threshold -> +1
    metric beyond its severe threshold  -> +2 additional (so +3 in total)

    total 0-1 -> Normal | 2-4 -> Monitor | 5+ -> Severe
    any required metric missing/invalid -> Invalid (no score)
"""
import math

NORMAL = "Normal"
MONITOR = "Monitor"
SEVERE = "Severe"
INVALID = "Invalid"
SEVERITIES = [NORMAL, MONITOR, SEVERE, INVALID]

# direction "high": bad when value is ABOVE the threshold
# direction "low":  bad when value is BELOW the threshold
RULES = {
    "latency_ms": {
        "label": "latency", "unit": " ms", "direction": "high",
        "monitor": 60, "severe": 100, "reason": "High latency",
    },
    "packet_loss_pct": {
        "label": "packet loss", "unit": "%", "direction": "high",
        "monitor": 1, "severe": 3, "reason": "High packet loss",
    },
    "throughput_mbps": {
        "label": "throughput", "unit": " Mbps", "direction": "low",
        "monitor": 10, "severe": 5, "reason": "Low throughput",
    },
    "congestion_pct": {
        "label": "congestion", "unit": "%", "direction": "high",
        "monitor": 70, "severe": 85, "reason": "High congestion",
    },
}

MONITOR_POINTS = 1
SEVERE_EXTRA_POINTS = 2


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))


def _fmt(value) -> str:
    return f"{value:g}"


def _exceeds(value, threshold, direction) -> bool:
    return value > threshold if direction == "high" else value < threshold


def score_metric(metric: str, value):
    """Return (points, reason_or_None) for a single metric value."""
    rule = RULES[metric]
    if not _exceeds(value, rule["monitor"], rule["direction"]):
        return 0, None
    points = MONITOR_POINTS
    if _exceeds(value, rule["severe"], rule["direction"]):
        points += SEVERE_EXTRA_POINTS
    return points, f"{rule['reason']} ({_fmt(value)}{rule['unit']})"


def severity_from_score(score: int) -> str:
    if score >= 5:
        return SEVERE
    if score >= 2:
        return MONITOR
    return NORMAL


def classify(measurement: dict) -> dict:
    """Classify one measurement (dict with the four metric keys).

    Returns {"severity": str, "priority_score": int | None, "reasons": [str]}.
    """
    missing = [m for m in RULES if _is_missing(measurement.get(m))]
    if missing:
        return {
            "severity": INVALID,
            "priority_score": None,
            "reasons": [f"Missing or invalid: {', '.join(missing)}"],
        }

    total = 0
    reasons = []
    for metric in RULES:
        points, reason = score_metric(metric, float(measurement[metric]))
        total += points
        if reason:
            reasons.append(reason)

    if not reasons:
        reasons = ["All indicators within normal range"]
    return {
        "severity": severity_from_score(total),
        "priority_score": total,
        "reasons": reasons,
    }
