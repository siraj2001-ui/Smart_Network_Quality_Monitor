
from app import app


def test_health_endpoint():
    client = app.test_client()

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_customers_endpoint():
    client = app.test_client()

    response = client.get("/api/customers")

    assert response.status_code == 200

    customers = response.get_json()

    assert len(customers) == 60

    customer_ids = [
        customer["customer_id"]
        for customer in customers
    ]

    assert len(customer_ids) == len(set(customer_ids))

def test_summary_counts():
    client = app.test_client()

    response = client.get("/api/summary")

    assert response.status_code == 200

    data = response.get_json()

    assert data["total_customers"] == 60

    total_classified = (
        data["normal"]
        + data["monitor"]
        + data["severe"]
        + data["invalid"]
    )

    assert total_classified == data["total_customers"]

    
def test_customer_filters():
    client = app.test_client()

    response = client.get(
        "/api/customers?city=Benghazi&severity=Severe"
    )

    assert response.status_code == 200

    customers = response.get_json()

    assert len(customers) == 3

    for customer in customers:
        assert customer["city"] == "Benghazi"
        assert customer["Severity"] == "Severe"

    scores = [
        customer["Priority_Score"]
        for customer in customers
    ]

    assert scores == sorted(scores, reverse=True)


def test_customer_history():
    client = app.test_client()

    response = client.get("/api/customers/C001/history")

    assert response.status_code == 200

    data = response.get_json()

    assert data["customer_id"] == "C001"

    history = data["history"]

    assert len(history) == 3

    timestamps = [
        record["timestamp"]
        for record in history
    ]

    assert timestamps == sorted(timestamps)

    for record in history:
        assert record["customer_id"] == "C001"
        assert "latency_ms" in record
        assert "throughput_mbps" in record
        assert "packet_loss_pct" in record
        assert "congestion_pct" in record
        assert "Priority_Score" in record
        assert "Severity" in record
        assert "Reasons" in record



def test_customer_history_not_found():
    client = app.test_client()

    response = client.get("/api/customers/C999/history")

    assert response.status_code == 404

    data = response.get_json()

    assert data == {
        "error": "Customer not found"
    }


def test_regions_match_summary():
    client = app.test_client()

    regions_response = client.get("/api/regions")
    summary_response = client.get("/api/summary")

    assert regions_response.status_code == 200
    assert summary_response.status_code == 200

    regions = regions_response.get_json()["regions"]
    summary = summary_response.get_json()

    assert len(regions) == 4

    expected_cities = {
        "Al Bayda",
        "Benghazi",
        "Misrata",
        "Tripoli"
    }

    actual_cities = {
        region["city"]
        for region in regions
    }

    assert actual_cities == expected_cities

    for region in regions:
        classification_total = (
            region["normal"]
            + region["monitor"]
            + region["severe"]
            + region["invalid"]
        )

        assert classification_total == region["total_customers"]

    assert sum(
        region["total_customers"]
        for region in regions
    ) == summary["total_customers"]

    for severity in ("normal", "monitor", "severe", "invalid"):
        assert sum(
            region[severity]
            for region in regions
        ) == summary[severity]

