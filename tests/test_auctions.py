"""
test_auctions.py — Auction lifecycle E2E tests.

Tests run against a session-scoped fresh auction (lifecycle_auction_id)
plus the seeded auctions. Tests within this file are ordered because they
progress the lifecycle_auction through state transitions.

Covers:
  - POST /auctions (create)
  - GET /auctions, GET /auctions/:id
  - PATCH /auctions/:id/publish, /open, /close, /award, /cancel
  - Invalid state transitions → 422
  - POST /auctions/:id/clone
  - POST /auctions/:id/lots, GET /auctions/:id/lots
"""

import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def post(path: str, headers: dict, body: dict) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", headers=headers, json=body, timeout=15)


def patch(path: str, headers: dict, body: dict | None = None) -> requests.Response:
    return requests.patch(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=15)


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)


class TestCreateAuction:
    def test_buyer_can_create_auction(self, buyer1_headers):
        resp = post("/auctions", buyer1_headers, {
            "title": "Temp Auction for Creation Test",
            "description": "Test auction",
            "category": "office-supplies",
            "type": "REVERSE",
            "ceilingPrice": 100000,
            "minDecrement": 1000,
            "autoExtendEnabled": True,
            "autoExtendMinutes": 2,
            "visibility": "RANK",
        })
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["status"] == "DRAFT"
        assert data["type"] == "REVERSE"
        assert data["ceiling_price"] == 100000
        assert "id" in data

    def test_vendor_cannot_create_auction(self, vendor1_headers):
        resp = post("/auctions", vendor1_headers, {
            "title": "Vendor Attempt",
            "category": "office-supplies",
            "type": "REVERSE",
            "ceilingPrice": 100000,
        })
        assert resp.status_code == 403

    def test_unauthenticated_cannot_create_auction(self):
        resp = post("/auctions", {}, {
            "title": "No Auth Attempt",
            "category": "office-supplies",
            "type": "REVERSE",
            "ceilingPrice": 100000,
        })
        assert resp.status_code == 401

    def test_create_auction_missing_required_field(self, buyer1_headers):
        resp = post("/auctions", buyer1_headers, {
            "title": "Missing Category",
            # category is required
            "type": "REVERSE",
            "ceilingPrice": 100000,
        })
        assert resp.status_code == 400

    def test_create_auction_invalid_type(self, buyer1_headers):
        resp = post("/auctions", buyer1_headers, {
            "title": "Bad Type",
            "category": "test",
            "type": "INVALID_TYPE",
            "ceilingPrice": 100000,
        })
        assert resp.status_code == 400


class TestListAndGetAuctions:
    def test_buyer_can_list_own_auctions(self, buyer1_headers, lifecycle_auction_id):
        resp = get("/auctions", buyer1_headers)
        assert resp.status_code == 200
        auctions = resp.json()["data"]
        assert isinstance(auctions, list)
        ids = [a["id"] for a in auctions]
        assert lifecycle_auction_id in ids

    def test_buyer_can_get_auction_detail(self, buyer1_headers, lifecycle_auction_id):
        resp = get(f"/auctions/{lifecycle_auction_id}", buyer1_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == lifecycle_auction_id

    def test_buyer_cannot_get_another_buyers_auction(self, buyer2_headers, lifecycle_auction_id):
        resp = get(f"/auctions/{lifecycle_auction_id}", buyer2_headers)
        assert resp.status_code == 403

    def test_get_nonexistent_auction_returns_404(self, buyer1_headers):
        resp = get("/auctions/00000000-0000-4000-8000-000000000001", buyer1_headers)
        assert resp.status_code == 404


class TestStateTransitions:
    """
    These tests progress lifecycle_auction_id through its states.
    They run in definition order (pytest default within a file).
    """

    def test_publish_transitions_draft_to_published(self, buyer1_headers, lifecycle_auction_id):
        resp = patch(f"/auctions/{lifecycle_auction_id}/publish", buyer1_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "PUBLISHED"

    def test_open_transitions_published_to_open(self, buyer1_headers, lifecycle_auction_id):
        resp = patch(f"/auctions/{lifecycle_auction_id}/open", buyer1_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "OPEN"

    def test_close_transitions_open_to_closed(self, buyer1_headers, lifecycle_auction_id):
        resp = patch(f"/auctions/{lifecycle_auction_id}/close", buyer1_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "CLOSED"

    def test_award_transitions_closed_to_awarded(self, buyer1_headers, lifecycle_auction_id):
        resp = patch(f"/auctions/{lifecycle_auction_id}/award", buyer1_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "AWARDED"


class TestInvalidTransitions:
    def test_cannot_skip_from_draft_to_open(self, buyer1_headers):
        # Create a fresh DRAFT auction and attempt to open it directly
        r = post("/auctions", buyer1_headers, {
            "title": "Skip Test Auction",
            "category": "test",
            "type": "REVERSE",
            "ceilingPrice": 50000,
        })
        auction_id = r.json()["data"]["id"]
        resp = patch(f"/auctions/{auction_id}/open", buyer1_headers)
        assert resp.status_code == 422

    def test_cannot_reopen_closed_auction(self, buyer1_headers, lifecycle_auction_id):
        # lifecycle_auction is now AWARDED — try to open it
        resp = patch(f"/auctions/{lifecycle_auction_id}/open", buyer1_headers)
        assert resp.status_code == 422


class TestCancelAuction:
    def test_can_cancel_draft_auction(self, buyer1_headers):
        r = post("/auctions", buyer1_headers, {
            "title": "To Be Cancelled",
            "category": "test",
            "type": "REVERSE",
            "ceilingPrice": 50000,
        })
        auction_id = r.json()["data"]["id"]
        resp = patch(f"/auctions/{auction_id}/cancel", buyer1_headers, {
            "reason": "Budget cut, procurement cancelled",
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "CANCELLED"
        assert data["cancellation_reason"] == "Budget cut, procurement cancelled"

    def test_cancel_requires_reason(self, buyer1_headers):
        r = post("/auctions", buyer1_headers, {
            "title": "No Reason Cancel",
            "category": "test",
            "type": "REVERSE",
            "ceilingPrice": 50000,
        })
        auction_id = r.json()["data"]["id"]
        resp = patch(f"/auctions/{auction_id}/cancel", buyer1_headers, {})
        assert resp.status_code == 400

    def test_cannot_cancel_already_cancelled_auction(self, buyer1_headers):
        r = post("/auctions", buyer1_headers, {
            "title": "Double Cancel Test",
            "category": "test",
            "type": "REVERSE",
            "ceilingPrice": 50000,
        })
        auction_id = r.json()["data"]["id"]
        patch(f"/auctions/{auction_id}/cancel", buyer1_headers, {"reason": "First cancel"})
        resp = patch(f"/auctions/{auction_id}/cancel", buyer1_headers, {"reason": "Second cancel"})
        assert resp.status_code == 422


class TestCloneAuction:
    def test_clone_creates_draft_copy(self, buyer1_headers, auction_open_id):
        resp = post(f"/auctions/{auction_open_id}/clone", buyer1_headers, {})
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["status"] == "DRAFT"
        assert "(Copy)" in data["title"]
        assert data["id"] != auction_open_id


class TestLots:
    def test_add_lot_to_draft_auction(self, buyer1_headers):
        r = post("/auctions", buyer1_headers, {
            "title": "Lot Test Auction",
            "category": "stationery",
            "type": "REVERSE",
            "ceilingPrice": 80000,
        })
        auction_id = r.json()["data"]["id"]

        resp = post(f"/auctions/{auction_id}/lots", buyer1_headers, {
            "title": "A4 Paper Ream",
            "quantity": 500,
            "unit": "reams",
            "specifications": "80gsm, acid-free, brightness 92%",
        })
        assert resp.status_code == 201
        lot = resp.json()["data"]
        assert lot["title"] == "A4 Paper Ream"
        assert lot["quantity"] == 500
        assert lot["unit"] == "reams"

    def test_list_lots_returns_array(self, buyer1_headers):
        r = post("/auctions", buyer1_headers, {
            "title": "Multi Lot Auction",
            "category": "stationery",
            "type": "REVERSE",
            "ceilingPrice": 80000,
        })
        auction_id = r.json()["data"]["id"]
        post(f"/auctions/{auction_id}/lots", buyer1_headers, {
            "title": "Lot 1", "quantity": 100, "unit": "pcs"
        })
        post(f"/auctions/{auction_id}/lots", buyer1_headers, {
            "title": "Lot 2", "quantity": 200, "unit": "pcs"
        })
        resp = get(f"/auctions/{auction_id}/lots", buyer1_headers)
        assert resp.status_code == 200
        lots = resp.json()["data"]
        assert len(lots) == 2
