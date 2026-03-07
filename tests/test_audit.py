"""
test_audit.py — Audit trail E2E tests.

Uses seeded Auction A (auction_open_id) which has had multiple state transitions
and bid actions, generating an audit trail.

Covers:
  - GET /auctions/:id/audit
  - GET /auctions/:id/audit/export (CSV download)
"""

import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)


class TestAuditTrail:
    def test_buyer_can_view_audit_trail(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", buyer1_headers)
        assert resp.status_code == 200
        logs = resp.json()["data"]
        assert isinstance(logs, list)
        assert len(logs) >= 1

    def test_audit_logs_have_expected_fields(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", buyer1_headers)
        logs = resp.json()["data"]
        assert logs, "Expected at least one audit log"
        log = logs[0]
        assert "id" in log
        assert "action" in log
        assert "actor_type" in log
        assert log["actor_type"] in ("BUYER", "VENDOR", "SYSTEM", "AGENT")
        assert "created_at" in log

    def test_audit_trail_includes_auction_events(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", buyer1_headers)
        logs = resp.json()["data"]
        actions = {log["action"] for log in logs}
        # Auction A was CREATED, PUBLISHED, OPENED — all should be in the trail
        expected_actions = {"AUCTION_CREATED", "AUCTION_PUBLISHED", "AUCTION_OPENED"}
        assert expected_actions.issubset(actions), (
            f"Missing audit actions: {expected_actions - actions}"
        )

    def test_audit_trail_includes_bid_events(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", buyer1_headers)
        logs = resp.json()["data"]
        actions = {log["action"] for log in logs}
        assert "BID_ACCEPTED" in actions, "Expected BID_ACCEPTED in audit trail"

    def test_vendor_cannot_view_audit_trail(self, vendor1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", vendor1_headers)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_view_audit_trail(self, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", {})
        assert resp.status_code == 401

    def test_audit_trail_is_ordered_by_created_at_descending(self, buyer1_headers, auction_open_id):
        resp = get(f"/auctions/{auction_open_id}/audit", buyer1_headers)
        logs = resp.json()["data"]
        if len(logs) >= 2:
            # First log should be the most recent
            assert logs[0]["created_at"] >= logs[-1]["created_at"]


class TestAuditExport:
    def test_buyer_can_export_audit_as_csv(self, buyer1_headers, auction_open_id):
        resp = requests.get(
            f"{BASE_URL}/auctions/{auction_open_id}/audit/export",
            headers=buyer1_headers,
            timeout=15,
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("Content-Type", "")

    def test_csv_export_has_header_row(self, buyer1_headers, auction_open_id):
        resp = requests.get(
            f"{BASE_URL}/auctions/{auction_open_id}/audit/export",
            headers=buyer1_headers,
            timeout=15,
        )
        content = resp.text
        first_line = content.splitlines()[0].lower()
        # CSV header should contain expected column names
        assert "action" in first_line
        assert "actor_type" in first_line
        assert "created_at" in first_line

    def test_csv_export_contains_data_rows(self, buyer1_headers, auction_open_id):
        resp = requests.get(
            f"{BASE_URL}/auctions/{auction_open_id}/audit/export",
            headers=buyer1_headers,
            timeout=15,
        )
        lines = [l for l in resp.text.splitlines() if l.strip()]
        # Header + at least one data row
        assert len(lines) >= 2

    def test_vendor_cannot_export_audit_csv(self, vendor1_headers, auction_open_id):
        resp = requests.get(
            f"{BASE_URL}/auctions/{auction_open_id}/audit/export",
            headers=vendor1_headers,
            timeout=15,
        )
        assert resp.status_code == 403
