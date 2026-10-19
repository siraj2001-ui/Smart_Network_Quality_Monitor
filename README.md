# Smart Network Quality Monitor

A local prototype showing how an ISP can analyse customer network measurements,
classify each customer's **latest** measurement (Normal / Monitor / Severe / Invalid),
explain why, and display the results in a dashboard backed by a REST API.

Pipeline: `CSV -> Pandas cleaning -> classification -> Flask REST API -> dashboard`

## Requirements

- Python 3.10+
- Git
- VS Code (recommended)
# Network Quality Rule-Based Classification Module

## Purpose
Classify each customer measurement record using **fixed project requirements**, not machine learning. The API teammate can import `analyze_customer` from `quality_rules.py`.

## Inputs and per-metric thresholds

| Metric | Normal (0 pts) | Monitor (1 pt) | Severe (3 pts) |
|---|---|---|---|
| `latency_ms` | ≤ 60 | >60 to ≤100 | >100 |
| `packet_loss_pct` | ≤ 1 | >1 to ≤3 | >3 |
| `throughput_mbps` | ≥ 10 | <10 to ≥5 | <5 |
| `congestion_pct` | ≤ 70 | >70 to ≤85 | >85 |

Priority score is the sum of all four per-metric points, from 0 to 12.

**Final classification:** 0–1 = `Normal`; 2–4 = `Monitor`; 5–12 = `Severe`. Invalid input returns `Invalid` with a `null` score. A single Severe metric adds 3 points, so the **final** classification can still be Monitor; this follows the supplied score rules.

Missing values, nonnumeric values, booleans, infinity, NaN, negative values, and percentages above 100 are invalid. All measurements must be present. Numeric strings are accepted. These validation conventions should be confirmed with the team if API input contracts differ.

