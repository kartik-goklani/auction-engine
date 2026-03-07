"""
test_bids.py — Bid submission and validation E2E tests.

Uses bid_test_auction_id — a fresh OPEN REVERSE auction with:
  - ceiling: 500000 (₹5000), min_decrement: 5000 (₹50)
  - vendor1, vendor2, vendor3 invited and ACCEPTED
  - vendor4 NOT invited (used for VENDOR_NOT_ELIGIBLE test)

Tests run in definition order (pytest default) because each bid changes
the "current best" that later tests build upon.

Bid sequence:
  1. vendor1 bids 480000 → ACCEPTED (establishes current best)
  2. vendor2 bids 600000 → REJECTED (ABOVE_CEILING)
  3. vendor4 bids 450000 → REJECTED (VENDOR_NOT_ELIGIBLE — not invited)
  4. vendor2 bids 476000 → REJECTED (BELOW_DECREMENT: 480000 - 5000 = 475000 threshold)
  5. vendor2 bids 470000 → ACCEPTED (470000 ≤ 475000, valid)
  6. vendor2 bids 460000 → REJECTED (RATE_LIMITED — immediate second bid)

Covers:
  - POST /auctions/:id/bids (all 5 rejection scenarios + success)
  - GET /auctions/:id/bids (buyer only)
  - GET /auctions/:id/bids/mine (vendor own bids)
  - GET /auctions/:id/bids/best
"""

import time
import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def submit_bid(auction_id: str, amount: int, headers: dict) -> dict:
    """Submit a bid and return the parsed response body."""
    resp = requests.post(
        f"{BASE_URL}/auctions/{auction_id}/bids",
        headers=headers,
        json={"amount": amount},
        timeout=15,
    )
    assert resp.status_code == 200, f"Unexpected status {resp.status_code}: {resp.text}"
    return resp.json()["data"]


class TestBidSubmission:
    def test_accepted_bid_below_ceiling(self, bid_test_auction_id, vendor1_headers):
        """vendor1 places first bid — should be accepted."""
        result = submit_bid(bid_test_auction_id, 480000, vendor1_headers)
        assert result["status"] == "ACCEPTED"
        assert result["amount"] == 480000
        assert "id" in result
        assert "submitted_at" in result

    def test_bid_above_ceiling_is_rejected(self, bid_test_auction_id, vendor2_headers):
        result = submit_bid(bid_test_auction_id, 600000, vendor2_headers)
        assert result["status"] == "REJECTED"
        assert result["rejection_reason"] == "ABOVE_CEILING"

    def test_uninvited_vendor_bid_is_rejected(self, bid_test_auction_id, vendor4_headers):
        """vendor4 is not invited to bid_test_auction."""
        result = submit_bid(bid_test_auction_id, 450000, vendor4_headers)
        assert result["status"] == "REJECTED"
        assert result["rejection_reason"] == "VENDOR_NOT_ELIGIBLE"

    def test_bid_not_beating_decrement_is_rejected(self, bid_test_auction_id, vendor2_headers):
        """
        Current best: 480000. min_decrement: 5000.
        REVERSE threshold: must bid ≤ 475000.
        Bidding 476000 is not enough improvement → BELOW_DECREMENT.
        """
        result = submit_bid(bid_test_auction_id, 476000, vendor2_headers)
        assert result["status"] == "REJECTED"
        assert result["rejection_reason"] == "BELOW_DECREMENT"

    def test_valid_bid_updates_current_best(self, bid_test_auction_id, vendor2_headers):
        """vendor2 bids 470000 — valid (≤ 475000 threshold)."""
        result = submit_bid(bid_test_auction_id, 470000, vendor2_headers)
        assert result["status"] == "ACCEPTED"
        assert result["amount"] == 470000

    def test_immediate_second_bid_is_rate_limited(self, bid_test_auction_id, vendor2_headers):
        """
        vendor2 just bid — submitting another bid immediately triggers RATE_LIMITED.
        The 3-second window is enforced server-side.
        """
        result = submit_bid(bid_test_auction_id, 460000, vendor2_headers)
        assert result["status"] == "REJECTED"
        assert result["rejection_reason"] == "RATE_LIMITED"

    def test_bid_on_non_open_auction_is_rejected(self, auction_closed_id, vendor1_headers):
        """Auction B is CLOSED — bidding on it should return AUCTION_NOT_OPEN."""
        result = submit_bid(auction_closed_id, 100000, vendor1_headers)
        assert result["status"] == "REJECTED"
        assert result["rejection_reason"] == "AUCTION_NOT_OPEN"

    def test_buyer_cannot_submit_bid(self, bid_test_auction_id, buyer1_headers):
        """Bid endpoint requires @Roles('vendor')."""
        resp = requests.post(
            f"{BASE_URL}/auctions/{bid_test_auction_id}/bids",
            headers=buyer1_headers,
            json={"amount": 400000},
            timeout=15,
        )
        assert resp.status_code == 403


class TestBidQueries:
    def test_buyer_can_view_all_bids(self, bid_test_auction_id, buyer1_headers):
        resp = requests.get(
            f"{BASE_URL}/auctions/{bid_test_auction_id}/bids",
            headers=buyer1_headers,
            timeout=15,
        )
        assert resp.status_code == 200
        bids = resp.json()["data"]
        assert isinstance(bids, list)
        # At least the ACCEPTED bids from above tests
        accepted = [b for b in bids if b["status"] == "ACCEPTED"]
        assert len(accepted) >= 2

    def test_vendor_cannot_view_all_bids(self, bid_test_auction_id, vendor1_headers):
        resp = requests.get(
            f"{BASE_URL}/auctions/{bid_test_auction_id}/bids",
            headers=vendor1_headers,
            timeout=15,
        )
        assert resp.status_code == 403

    def test_vendor_can_view_own_bids(self, bid_test_auction_id, vendor1_headers):
        resp = requests.get(
            f"{BASE_URL}/auctions/{bid_test_auction_id}/bids/mine",
            headers=vendor1_headers,
            timeout=15,
        )
        assert resp.status_code == 200
        bids = resp.json()["data"]
        # All returned bids should belong to vendor1 (can't directly check vendor_id,
        # but the endpoint is filtered server-side)
        assert isinstance(bids, list)
        assert len(bids) >= 1

    def test_get_best_bid_returns_current_leader(self, bid_test_auction_id, buyer1_headers):
        resp = requests.get(
            f"{BASE_URL}/auctions/{bid_test_auction_id}/bids/best",
            headers=buyer1_headers,
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        # For a REVERSE auction, best bid is the lowest accepted amount
        assert "bestBid" in data
        assert "totalBids" in data
        assert data["totalBids"] >= 2

    def test_buyer_can_view_bids_from_seeded_open_auction(self, auction_open_id, buyer1_headers):
        resp = requests.get(
            f"{BASE_URL}/auctions/{auction_open_id}/bids",
            headers=buyer1_headers,
            timeout=15,
        )
        assert resp.status_code == 200
        bids = resp.json()["data"]
        # Seeded auction has 12 bids
        assert len(bids) >= 12
