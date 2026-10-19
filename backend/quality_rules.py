
import pandas as pd
import numpy as np


def CM(value, metric):

    if metric == "latency_ms":
        if value <= 60:
            return "Normal"
        elif value <= 100:
            return "Monitor"
        else:
            return "Severe"

    elif metric == "packet_loss_pct":
        if value <= 1:
            return "Normal"
        elif value <= 3:
            return "Monitor"
        else:
            return "Severe"

    elif metric == "throughput_mbps":
        if value >= 10:
            return "Normal"
        elif value >= 5:
            return "Monitor"
        else:
            return "Severe"

    elif metric == "congestion_pct":
        if value <= 70:
            return "Normal"
        elif value <= 85:
            return "Monitor"
        else:
            return "Severe"

    raise ValueError("Unknown metric")


features = [
    "latency_ms",
    "packet_loss_pct",
    "throughput_mbps",
    "congestion_pct"
]


def validate_customer(row):

    for metric in features:

        if metric not in row:
            return False

        value = row[metric]

        if pd.isna(value):
            return False

        if isinstance(value, (bool, np.bool_)):
            return False

        try:
            value = float(value)
        except (ValueError, TypeError):
            return False

        if not np.isfinite(value) or value < 0:
            return False

        if metric in ["packet_loss_pct", "congestion_pct"] and value > 100:
            return False

    return True


def calculate_priority(row):

    if not validate_customer(row):
        return None

    score = 0

    for metric in features:

        severity = CM(
            float(row[metric]), metric
        )

        if severity == "Monitor":
            score += 1

        elif severity == "Severe":
            score += 2

    return score


def classify_customer(row):

    score = calculate_priority(row)

    if score is None:
        return "Invalid"

    if score <= 1:
        return "Normal"

    elif score <= 4:
        return "Monitor"

    else:
        return "Severe"


def generate_reasons(row):

    if not validate_customer(row):
        return ["Invalid or missing network measurements"]

    reasons = []

    latency = float(row["latency_ms"])
    packet_loss = float(row["packet_loss_pct"])
    throughput = float(row["throughput_mbps"])
    congestion = float(row["congestion_pct"])

    if latency > 60:
        reasons.append(f"High Latency ({latency:g} ms)")

    if packet_loss > 1:
        reasons.append(f"High Packet Loss ({packet_loss:g}%)")

    if throughput < 10:
        reasons.append(f"Low Throughput ({throughput:g} Mbps)")

    if congestion > 70:
        reasons.append(f"High Congestion ({congestion:g}%)")

    if not reasons:
        reasons.append(
            "All network measurements are within normal thresholds."
        )

    return reasons
