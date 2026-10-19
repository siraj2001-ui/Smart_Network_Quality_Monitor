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

## Usage

```python
from quality_rules import analyze_customer
customer = {'latency_ms': 125, 'packet_loss_pct': 4.2,
            'throughput_mbps': 15, 'congestion_pct': 60}
result = analyze_customer(customer)
# {'severity': 'Severe', 'priority_score': 6, 'reasons': [...actual measurements...]}
```

No Flask, training, model weights, or pandas dependency is required.

## Tests

From the folder containing both Python files, run:

```bash
python3 -m unittest -v test_quality_rules.py
```

Tests cover Normal, Monitor, Severe, Invalid, threshold boundaries, dynamic explanations, and the important distinction between per-metric severity and final score-based severity.

## Integration contract

`analyze_customer(customer)` takes a dictionary-like object with the four named metrics and returns a JSON-serializable dictionary with `severity` (string), `priority_score` (integer or `None`), and `reasons` (list of strings). The API owner handles HTTP routing and status codes separately.
