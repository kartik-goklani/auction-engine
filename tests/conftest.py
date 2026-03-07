"""
conftest.py — Shared fixtures for the Auction Engine E2E test suite.

All fixtures are session-scoped (login once, reuse across all tests).
Run seed.py before running pytest to populate .env.test with entity IDs.

Usage:
    cd auction-engine/tests
    python seed.py
    pytest -v --tb=short
"""

import os
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(".env.test")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = os.getenv("BASE_URL", "http://localhost:3001/api/v1")
PASSWORD = "Seed1234!"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _login(email: str) -> str:
    """Log in via the backend and return the JWT access token."""
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=15,
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["data"]["accessToken"]


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get(path: str, headers: dict) -> dict:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15).json()


def _post(path: str, headers: dict, body: dict) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", headers=headers, json=body, timeout=15)


def _patch(path: str, headers: dict, body: dict | None = None) -> requests.Response:
    return requests.patch(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=15)


# ---------------------------------------------------------------------------
# Auth tokens (session-scoped — login once per pytest run)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def buyer1_token() -> str:
    return _login(os.getenv("BUYER1_EMAIL", "buyer1@aitt.test"))


@pytest.fixture(scope="session")
def buyer2_token() -> str:
    return _login(os.getenv("BUYER2_EMAIL", "buyer2@aitt.test"))


@pytest.fixture(scope="session")
def vendor1_token() -> str:
    return _login(os.getenv("VENDOR1_EMAIL", "vendor1@aitt.test"))


@pytest.fixture(scope="session")
def vendor2_token() -> str:
    return _login(os.getenv("VENDOR2_EMAIL", "vendor2@aitt.test"))


@pytest.fixture(scope="session")
def vendor3_token() -> str:
    return _login(os.getenv("VENDOR3_EMAIL", "vendor3@aitt.test"))


@pytest.fixture(scope="session")
def vendor4_token() -> str:
    return _login(os.getenv("VENDOR4_EMAIL", "vendor4@aitt.test"))


# ---------------------------------------------------------------------------
# Auth header bundles (convenience wrappers)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def buyer1_headers(buyer1_token) -> dict:
    return _bearer(buyer1_token)


@pytest.fixture(scope="session")
def buyer2_headers(buyer2_token) -> dict:
    return _bearer(buyer2_token)


@pytest.fixture(scope="session")
def vendor1_headers(vendor1_token) -> dict:
    return _bearer(vendor1_token)


@pytest.fixture(scope="session")
def vendor2_headers(vendor2_token) -> dict:
    return _bearer(vendor2_token)


@pytest.fixture(scope="session")
def vendor3_headers(vendor3_token) -> dict:
    return _bearer(vendor3_token)


@pytest.fixture(scope="session")
def vendor4_headers(vendor4_token) -> dict:
    return _bearer(vendor4_token)


# ---------------------------------------------------------------------------
# Seeded entity IDs (written to .env.test by seed.py)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def vendor1_id() -> str:
    v = os.getenv("VENDOR1_ID", "")
    assert v, "VENDOR1_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def vendor2_id() -> str:
    v = os.getenv("VENDOR2_ID", "")
    assert v, "VENDOR2_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def vendor3_id() -> str:
    v = os.getenv("VENDOR3_ID", "")
    assert v, "VENDOR3_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def vendor4_id() -> str:
    v = os.getenv("VENDOR4_ID", "")
    assert v, "VENDOR4_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def auction_open_id() -> str:
    """Auction A — OPEN REVERSE with 12 bids including collusion pattern."""
    v = os.getenv("AUCTION_OPEN_ID", "")
    assert v, "AUCTION_OPEN_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def auction_closed_id() -> str:
    """Auction B — CLOSED FORWARD with award recommendation."""
    v = os.getenv("AUCTION_CLOSED_ID", "")
    assert v, "AUCTION_CLOSED_ID not set in .env.test — run seed.py first"
    return v


@pytest.fixture(scope="session")
def auction_published_id() -> str:
    """Auction C — PUBLISHED SEALED_BID."""
    v = os.getenv("AUCTION_PUBLISHED_ID", "")
    assert v, "AUCTION_PUBLISHED_ID not set in .env.test — run seed.py first"
    return v


# ---------------------------------------------------------------------------
# Session-scoped fresh auctions (created once per test session)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def lifecycle_auction_id(buyer1_headers) -> str:
    """
    A fresh DRAFT auction used by test_auctions.py for lifecycle tests.
    Created once per session; tests operate on it in order.
    """
    resp = _post("/auctions", buyer1_headers, {
        "title": "E2E Lifecycle Test Auction",
        "description": "Created by pytest session fixture",
        "category": "office-supplies",
        "type": "REVERSE",
        "ceilingPrice": 300000,
        "minDecrement": 3000,
        "autoExtendEnabled": False,
        "visibility": "RANK",
    })
    assert resp.status_code == 201, f"Failed to create lifecycle auction: {resp.text}"
    return resp.json()["data"]["id"]


@pytest.fixture(scope="session")
def bid_test_auction_id(buyer1_headers, vendor1_id, vendor2_id, vendor3_id,
                        vendor1_headers, vendor2_headers, vendor3_headers) -> str:
    """
    A fresh OPEN REVERSE auction used exclusively by test_bids.py.

    Setup:
      - ceiling: 500000 (₹5000), min_decrement: 5000 (₹50)
      - vendor1, vendor2, vendor3 invited and ACCEPTED
      - vendor4 NOT invited (used for VENDOR_NOT_ELIGIBLE test)
    """
    resp = _post("/auctions", buyer1_headers, {
        "title": "E2E Bid Test Auction",
        "description": "Isolated auction for bid validation E2E tests",
        "category": "office-supplies",
        "type": "REVERSE",
        "ceilingPrice": 500000,
        "minDecrement": 5000,
        "autoExtendEnabled": False,
        "visibility": "PRICE",
    })
    assert resp.status_code == 201, f"Failed to create bid test auction: {resp.text}"
    auction_id = resp.json()["data"]["id"]

    # Publish → Open
    _patch(f"/auctions/{auction_id}/publish", buyer1_headers)
    _patch(f"/auctions/{auction_id}/open", buyer1_headers)

    # Invite v1, v2, v3 only (v4 stays uninvited for VENDOR_NOT_ELIGIBLE test)
    _post(f"/auctions/{auction_id}/invitations", buyer1_headers,
          {"vendorIds": [vendor1_id, vendor2_id, vendor3_id]})

    # Each vendor accepts their invitation
    for v_headers in (vendor1_headers, vendor2_headers, vendor3_headers):
        inv_resp = _get("/vendor/invitations", v_headers)
        for inv in inv_resp.get("data", []):
            if inv.get("auction_id") == auction_id and inv.get("status") == "INVITED":
                _patch(f"/vendor/invitations/{inv['id']}/respond", v_headers, {"status": "ACCEPTED"})
                break

    return auction_id


@pytest.fixture(scope="session")
def vendor_test_auction_id(buyer1_headers) -> str:
    """
    A fresh DRAFT auction used by test_vendors.py for invitation flow tests.
    Created fresh each session to avoid UNIQUE constraint conflicts.
    """
    resp = _post("/auctions", buyer1_headers, {
        "title": "E2E Vendor Invitation Test Auction",
        "description": "Used for testing vendor invitation flow",
        "category": "stationery",
        "type": "REVERSE",
        "ceilingPrice": 100000,
        "minDecrement": 1000,
        "autoExtendEnabled": False,
        "visibility": "RANK",
    })
    assert resp.status_code == 201, f"Failed to create vendor test auction: {resp.text}"
    return resp.json()["data"]["id"]
