# Smart Network Quality Monitor

A local prototype showing how an ISP can analyse customer network measurements,
classify each customer's **latest** measurement (Normal / Monitor / Severe / Invalid),
explain why, and display the results in a dashboard backed by a REST API.

Pipeline: `CSV -> Pandas cleaning -> classification -> Flask REST API -> dashboard`

## Requirements

- Python 3.10+
- Git
- VS Code (recommended)
