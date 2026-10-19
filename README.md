# Smart Network Quality Monitor

A local prototype showing how an ISP can analyse customer network measurements,
classify each customer's **latest** measurement (Normal / Monitor / Severe / Invalid),
explain why, and display the results in a dashboard backed by a REST API.

Pipeline: `CSV -> Pandas cleaning -> classification -> Flask REST API -> dashboard`

## Requirements

- Python 3.10+
- Git
- VS Code (recommended)

## Setup

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd network-quality-monitor

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows (cmd / PowerShell)

# 3. Install dependencies
pip install -r requirements.txt

# 4. Generate the synthetic dataset
python scripts/generate_sample_data.py
```

## Run

```bash
python app.py
```

Open <http://127.0.0.1:5000> in the browser.

## Run the tests

```bash
python -m pytest
```

## Project structure

```
network-quality-monitor/
├── app.py                     Flask app + API endpoints
├── data_loader.py             Read, validate and clean the CSV
├── quality_rules.py           Severity classification + priority score
├── service.py                 Combines the above into reusable services
├── static/
│   ├── index.html             Dashboard structure
│   ├── style.css              Dashboard styling
│   └── dashboard.js           Fetches API data, renders table + filters
├── tests/
│   └── test_quality_rules.py  Classification tests
├── scripts/
│   └── generate_sample_data.py  Synthetic CSV generator
├── data/
│   └── network_measurements.csv (generated)
├── docs/
│   ├── CONTRACT.md            Agreed data + API formats
│   └── GIT_WORKFLOW.md        Branching and merge rules
├── requirements.txt
└── README.md
```

## Dataset

One row = one measurement for one customer at one time.

| Column | Description | Example |
|---|---|---|
| customer_id | Unique customer ID | CUST-001 |
| timestamp | Measurement date/time | 2026-10-18 09:00 |
| latency_ms | Response time (ms) | 45 |
| throughput_mbps | Transfer rate (Mbps) | 20 |
| packet_loss_pct | Lost packets (%) | 0.5 |
| congestion_pct | Congestion (%) | 40 |
| city | Customer city | Benghazi |
| profile | Subscription profile | Home-20 |

A customer has many measurements. The app keeps **only the latest one per customer**,
so customers are never counted more than once.

To use a different CSV, set the `NQM_DATA` environment variable to its path.

## Data cleaning

1. Verify all required columns exist.
2. Convert `timestamp` to datetime; drop rows with no customer ID or an unreadable timestamp.
3. Non-numeric or unreasonable metric values (negative, or a percentage over 100) become missing.
4. Remove duplicates on `(customer_id, timestamp)`.
5. Sort chronologically, then take the latest row per customer.

If the latest measurement has a missing metric, that customer is **Invalid**.

## Classification

| Metric | Normal | Monitor (+1) | Severe (+2 more) |
|---|---|---|---|
| Latency | <= 60 ms | > 60 | > 100 |
| Packet loss | <= 1 % | > 1 | > 3 |
| Throughput | >= 10 Mbps | < 10 | < 5 |
| Congestion | <= 70 % | > 70 | > 85 |

Total score: **0-1 Normal**, **2-4 Monitor**, **5+ Severe**.
Missing/invalid measurements -> **Invalid** (no score).

Each result includes human-readable reasons built from the real values,
e.g. `High latency (125 ms)`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/summary` | KPI counts |
| `GET /api/customers` | Classified customers |
| `GET /api/options` | Values for the filter dropdowns |

`/api/customers` query parameters: `city`, `severity`, `profile`, `search` (customer ID),
`sort` (`score_desc` or `score_asc`). Full formats are in [docs/CONTRACT.md](docs/CONTRACT.md).

Example:

```
GET /api/customers?city=Benghazi&severity=Severe&sort=score_desc
```

## Team

| Member | Area |
|---|---|
| Mohammed Al-Warfali | Data loading, cleaning, KPIs (`data_loader.py`) |
| Aya Al-Shaikhi | Rules, scoring, reasons, tests (`quality_rules.py`, `tests/`) |
| Aseel Faraj | UI/UX wireframe and usability review |
| Ayat | Dashboard frontend (`static/`) |
| Batoul Bobtana | Flask API (`app.py`) |
| Siraj Ahmed | Structure, integration, Git workflow, README |

See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for how we collaborate.
