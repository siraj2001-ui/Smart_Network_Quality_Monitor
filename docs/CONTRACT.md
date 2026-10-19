# Team Contract

Agreed formats. **Change nothing here without telling the whole team**, because
every module depends on it.

## 1. Column names (CSV)

`customer_id, timestamp, latency_ms, throughput_mbps, packet_loss_pct, congestion_pct, city, profile`

## 2. Module interfaces

| Module | Function | Returns |
|---|---|---|
| `data_loader` | `load_measurements(path)` | `(clean_df, report_dict)` |
| `data_loader` | `latest_per_customer(df)` | DataFrame, one row per customer |
| `quality_rules` | `classify(measurement_dict)` | classification result (below) |
| `service` | `get_customers(city, severity, profile, search, sort)` | list of customer dicts |
| `service` | `get_summary()` | summary dict |
| `service` | `get_options()` | options dict |

## 3. Classification result

```json
{
  "severity": "Severe",
  "priority_score": 6,
  "reasons": ["High latency (125 ms)", "High packet loss (4.2%)"]
}
```

- `severity` is one of: `Normal`, `Monitor`, `Severe`, `Invalid`.
- `priority_score` is an integer, or `null` for `Invalid`.
- `reasons` is always a non-empty list of strings.

## 4. API responses

### `GET /api/health`
```json
{ "status": "ok" }
```

### `GET /api/summary`
```json
{ "total_customers": 60, "normal": 30, "monitor": 18, "severe": 10, "invalid": 2 }
```

### `GET /api/customers`
Query parameters (all optional): `city`, `severity`, `profile`, `search`, `sort`
(`score_desc` | `score_asc`).

```json
[
  {
    "customer_id": "CUST-001",
    "timestamp": "2026-10-18 15:00",
    "city": "Benghazi",
    "profile": "Home-20",
    "latency_ms": 125.0,
    "throughput_mbps": 20.0,
    "packet_loss_pct": 4.2,
    "congestion_pct": 40.0,
    "severity": "Severe",
    "priority_score": 6,
    "reasons": ["High latency (125 ms)", "High packet loss (4.2%)"]
  }
]
```

Missing metrics are `null`. Invalid customers sort last when sorting by score.

### `GET /api/options`
```json
{
  "cities": ["Benghazi", "Tripoli"],
  "profiles": ["Home-10", "Home-20"],
  "severities": ["Normal", "Monitor", "Severe", "Invalid"]
}
```

## 5. Severity colors (Aseel owns the final palette)

Always show the severity **as text**, not color alone.

| Severity | Color |
|---|---|
| Normal | green |
| Monitor | amber |
| Severe | red |
| Invalid | grey |
