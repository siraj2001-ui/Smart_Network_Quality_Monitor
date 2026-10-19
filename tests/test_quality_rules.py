import math

from quality_rules import INVALID, MONITOR, NORMAL, SEVERE, classify


def m(latency=40, throughput=20, loss=0.5, congestion=40):
    return {
        "latency_ms": latency,
        "throughput_mbps": throughput,
        "packet_loss_pct": loss,
        "congestion_pct": congestion,
    }


def test_all_good_is_normal():
    r = classify(m())
    assert r["severity"] == NORMAL
    assert r["priority_score"] == 0


def test_exact_thresholds_are_still_normal():
    # Boundaries: <=60 ms, <=1 %, >=10 Mbps, <=70 % are all "normal"
    assert classify(m(latency=60, loss=1, throughput=10, congestion=70))["severity"] == NORMAL


def test_one_monitor_metric_is_still_normal():
    r = classify(m(latency=70))
    assert r["priority_score"] == 1
    assert r["severity"] == NORMAL


def test_two_monitor_metrics_is_monitor():
    r = classify(m(latency=70, loss=1.5))
    assert r["priority_score"] == 2
    assert r["severity"] == MONITOR


def test_one_severe_metric_scores_three_is_monitor():
    r = classify(m(latency=125))
    assert r["priority_score"] == 3
    assert r["severity"] == MONITOR


def test_severe_needs_score_five_or_more():
    r = classify(m(latency=125, loss=4.2))
    assert r["priority_score"] == 6
    assert r["severity"] == SEVERE


def test_low_throughput_thresholds():
    assert classify(m(throughput=9))["priority_score"] == 1
    assert classify(m(throughput=4))["priority_score"] == 3


def test_reasons_use_actual_values():
    reasons = classify(m(latency=125, loss=4.2))["reasons"]
    assert "High latency (125 ms)" in reasons
    assert "High packet loss (4.2%)" in reasons


def test_normal_customer_has_a_reason_too():
    assert classify(m())["reasons"] == ["All indicators within normal range"]


def test_missing_metric_is_invalid_without_score():
    r = classify(m(throughput=None))
    assert r["severity"] == INVALID
    assert r["priority_score"] is None
    assert "throughput_mbps" in r["reasons"][0]


def test_nan_metric_is_invalid():
    assert classify(m(latency=math.nan))["severity"] == INVALID
