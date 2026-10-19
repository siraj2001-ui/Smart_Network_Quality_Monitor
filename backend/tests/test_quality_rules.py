
import pytest

from quality_rules import CM


@pytest.mark.parametrize(
    "value, metric, expected",
    [
        # Latency
        (60, "latency_ms", "Normal"),
        (61, "latency_ms", "Monitor"),
        (100, "latency_ms", "Monitor"),
        (101, "latency_ms", "Severe"),

        # Packet loss
        (1, "packet_loss_pct", "Normal"),
        (2, "packet_loss_pct", "Monitor"),
        (3, "packet_loss_pct", "Monitor"),
        (4, "packet_loss_pct", "Severe"),

        # Throughput
        (10, "throughput_mbps", "Normal"),
        (9, "throughput_mbps", "Monitor"),
        (5, "throughput_mbps", "Monitor"),
        (4, "throughput_mbps", "Severe"),

        # Congestion
        (70, "congestion_pct", "Normal"),
        (71, "congestion_pct", "Monitor"),
        (85, "congestion_pct", "Monitor"),
        (86, "congestion_pct", "Severe"),
    ]
)
def test_metric_classification(value, metric, expected):
    result = CM(value, metric)

    assert result == expected


from quality_rules import calculate_priority, classify_customer


def test_customer_priority_and_severity():
    customer = {
        "latency_ms": 125,
        "packet_loss_pct": 0.5,
        "throughput_mbps": 20,
        "congestion_pct": 40
    }

    assert calculate_priority(customer) == 2
    assert classify_customer(customer) == "Monitor"


from quality_rules import (
    validate_customer,
    generate_reasons
)


def test_invalid_customer_measurements():
    customer = {
        "latency_ms": 45,
        "packet_loss_pct": 120,
        "throughput_mbps": 20,
        "congestion_pct": 40
    }

    assert validate_customer(customer) is False
    assert calculate_priority(customer) is None
    assert classify_customer(customer) == "Invalid"

    assert generate_reasons(customer) == [
        "Invalid or missing network measurements"
    ]



def test_missing_customer_measurement():
    customer = {
        "latency_ms": 45,
        "packet_loss_pct": None,
        "throughput_mbps": 20,
        "congestion_pct": 40
    }

    assert validate_customer(customer) is False
    assert calculate_priority(customer) is None
    assert classify_customer(customer) == "Invalid"

