"""Generate a synthetic network_measurements.csv for development and demos.

Usage:  python scripts/generate_sample_data.py
Output: data/network_measurements.csv

Deliberately includes messy rows (duplicates, missing and unreasonable values)
so the cleaning code has something to prove itself on. Seeded => reproducible.
"""
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

CITIES = ["Benghazi", "Tripoli", "Misrata", "Tobruk", "Sabha", "Al Bayda"]
PROFILES = ["Home-10", "Home-20", "Home-50", "Business-100"]
N_CUSTOMERS = 60
OUT = Path(__file__).resolve().parent.parent / "data" / "network_measurements.csv"

# Quality "personality" per customer controls how bad their numbers tend to be
QUALITY_MIX = ["good"] * 30 + ["mid"] * 18 + ["bad"] * 12


def measurement(quality):
    if quality == "good":
        return (random.randint(15, 55), random.randint(12, 50),
                round(random.uniform(0, 0.9), 1), random.randint(10, 65))
    if quality == "mid":
        return (random.randint(55, 95), random.randint(5, 14),
                round(random.uniform(0.8, 2.8), 1), random.randint(60, 82))
    return (random.randint(95, 220), random.randint(1, 7),
            round(random.uniform(2.5, 9.0), 1), random.randint(80, 99))


def main():
    rows = []
    base = datetime(2026, 10, 18, 6, 0)
    qualities = QUALITY_MIX[:]
    random.shuffle(qualities)

    for i in range(1, N_CUSTOMERS + 1):
        cid = f"CUST-{i:03d}"
        city = random.choice(CITIES)
        profile = random.choice(PROFILES)
        quality = qualities[i - 1]
        for k in range(random.randint(3, 6)):
            ts = base + timedelta(hours=3 * k)
            lat, thr, loss, cong = measurement(quality)
            rows.append([cid, ts.strftime("%Y-%m-%d %H:%M"), lat, thr, loss, cong, city, profile])

    # --- inject messy data ---
    # exact duplicates (same customer + timestamp)
    for r in random.sample(rows, 5):
        rows.append(list(r))
    # missing metrics in the LATEST row of two customers -> they become Invalid
    for cid in ("CUST-007", "CUST-031"):
        latest = max((r for r in rows if r[0] == cid), key=lambda r: r[1])
        latest[3] = ""
    # unreasonable values
    random.choice(rows)[4] = -3        # negative packet loss
    random.choice(rows)[5] = 250       # congestion over 100%
    # a row with no customer id
    rows.append(["", "2026-10-18 09:00", 40, 20, 0.5, 40, "Benghazi", "Home-20"])

    random.shuffle(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["customer_id", "timestamp", "latency_ms", "throughput_mbps",
                    "packet_loss_pct", "congestion_pct", "city", "profile"])
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows for {N_CUSTOMERS} customers to {OUT}")


if __name__ == "__main__":
    main()
