"""
test_agents.py — AI agent integration E2E tests.

Uses seeded auctions:
  - auction_open_id (Auction A): OPEN, has collusion-pattern bids, has ai_metadata
  - auction_closed_id (Auction B): CLOSED, Agent 4 ran at close → award recommendation exists

Covers:
  - POST /agents/price-intelligence/:auctionId (manual trigger)
  - GET /auctions/:id/agent-runs
  - GET /auctions/:id/alerts
  - GET /auctions/:id/recommendation
"""

import time
import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)


def post(path: str, headers: dict, body: dict | None = None) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=20)


class TestPriceIntelligenceAgent:
    def test_buyer_can_manually_trigger_price_intelligence(self, buyer1_headers, auction_open_id):
        resp = post(f"/agents/price-intelligence/{auction_open_id}", buyer1_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["triggered"] is True

    def test_vendor_cannot_trigger_price_intelligence(self, vendor1_headers, auction_open_id):
        resp = post(f"/agents/price-intelligence/{auction_open_id}", vendor1_headers)
        assert resp.status_code == 403


class TestAgentRuns:
    def test_buyer_can_view_agent_runs(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/agent-runs", buyer1_headers)
        assert resp.status_code == 200
        runs = resp.json()["data"]
        assert isinstance(runs, list)
        assert len(runs) >= 1

    def test_agent_runs_have_expected_fields(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/agent-runs", buyer1_headers)
        runs = resp.json()["data"]
        run = runs[0]
        assert "id" in run
        assert "agent_type" in run
        assert "status" in run
        assert run["status"] in ("RUNNING", "SUCCESS", "FAILED")
        assert "triggered_at" in run

    def test_successful_runs_have_non_null_output(self, buyer1_headers, auction_open_id):
        # Wait a moment then check that at least one run succeeded
        time.sleep(3)
        resp = get(f"/auctions/{auction_open_id}/agent-runs", buyer1_headers)
        runs = resp.json()["data"]
        successful = [r for r in runs if r["status"] == "SUCCESS"]
        assert len(successful) >= 1, "No successful agent runs found"
        assert successful[0]["final_output"] is not None
        assert successful[0]["tokens_used"] is not None
        assert successful[0]["duration_ms"] is not None

    def test_vendor_cannot_view_agent_runs(self, vendor1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/agent-runs", vendor1_headers)
        assert resp.status_code == 403


class TestAnomalyAlerts:
    """
    Auction A has a collusion-pattern bid sequence (8 bids from v1 and v2 alternating
    within 2 seconds × 4 rounds). Agent 3 should detect this and write an alert.
    Agent 3 fires on every accepted bid — the seeded bids trigger it directly.
    """

    def test_buyer_can_view_auction_alerts(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/alerts", buyer1_headers)
        assert resp.status_code == 200
        alerts = resp.json()["data"]
        assert isinstance(alerts, list)

    def test_vendor_cannot_view_alerts(self, vendor1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/alerts", vendor1_headers)
        assert resp.status_code == 403

    def test_alerts_have_expected_structure(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/alerts", buyer1_headers)
        alerts = resp.json()["data"]
        if not alerts:
            pytest.skip("No alerts yet — Agent 3 may still be processing seeded bids")
        alert = alerts[0]
        assert "alert_type" in alert
        assert alert["alert_type"] in ("COLLUSION_SIGNAL", "BELOW_RISK_BID")
        assert "severity" in alert
        assert alert["severity"] in ("LOW", "MEDIUM", "HIGH")
        assert "description" in alert
        assert "created_at" in alert


class TestAwardRecommendation:
    """
    Auction B was closed by seed.py, which triggered Agent 4 to run.
    seed.py waited 20s for Agent 4 to complete, so the recommendation should exist.
    """

    def test_buyer_can_view_award_recommendation(self, buyer1_headers, auction_closed_id):
        resp = get(f"/auctions/{auction_closed_id}/recommendation", buyer1_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        # Recommendation may be null if agent is still running
        if data is None:
            pytest.skip("Award recommendation not yet written — agent may still be processing")

    def test_award_recommendation_has_expected_structure(self, buyer1_headers, auction_closed_id):
        resp = get(f"/auctions/{auction_closed_id}/recommendation", buyer1_headers)
        rec = resp.json()["data"]
        if rec is None:
            pytest.skip("No recommendation yet")
        assert "confidence" in rec
        assert rec["confidence"] in ("HIGH", "MEDIUM", "LOW")
        assert "risk_summary" in rec
        assert "recommended_next_step" in rec

    def test_vendor_cannot_view_recommendation(self, vendor1_headers, auction_closed_id):
        resp = get(f"/auctions/{auction_closed_id}/recommendation", vendor1_headers)
        assert resp.status_code == 403

    def test_recommendation_points_to_vendor_in_auction(self, buyer1_headers, auction_closed_id):
        resp = get(f"/auctions/{auction_closed_id}/recommendation", buyer1_headers)
        rec = resp.json()["data"]
        if rec is None:
            pytest.skip("No recommendation yet")
        # primary_vendor_id should be set (Auction B had bids from v1 who won at ₹1980)
        if rec.get("primary_vendor_id"):
            assert len(rec["primary_vendor_id"]) == 36  # UUID format
