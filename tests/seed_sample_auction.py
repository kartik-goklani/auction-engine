#!/usr/bin/env python3
"""
Auction Engine — Single Sample Auction Seed Script

Creates one realistic OPEN REVERSE auction with live bids, for demoing
the buyer/vendor portals and Agent 3 (Anomaly Detection):
  - 1 buyer: "Dubai Retail Group"
  - 4 vendors bidding on retail store fixtures
  - 7 bids placed via the live NestJS API

Idempotent — re-running skips entities that already exist by email/title.

Usage:
    cd auction-engine/tests
    cp .env.test.example .env.test       # fill in SUPABASE_URL and SERVICE_ROLE_KEY
    # start the backend: cd ../auction-backend && npm run start:dev
    python seed_sample_auction.py
"""

import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(".env.test")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3001/api/v1")
PASSWORD = "Seed1234!"

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _sb_headers(extra: dict | None = None) -> dict:
    h = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def sb_admin_create_user(email: str, password: str, role: str, metadata: dict) -> dict:
    """Create a Supabase auth user via Admin API. Returns the user dict."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    resp = requests.post(
        url,
        headers=_sb_headers(),
        json={
            "email": email,
            "password": password,
            "user_metadata": {"role": role, **metadata},
            "email_confirm": True,
        },
        timeout=15,
    )

    if resp.status_code in (200, 201):
        print(f"  [auth] Created user: {email}")
        return resp.json()

    # 422 = already registered — fetch existing user
    if resp.status_code == 422:
        return sb_admin_find_user(email)

    resp.raise_for_status()
    return {}


def sb_admin_find_user(email: str) -> dict:
    """Find an existing Supabase auth user by email (paginates through results)."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    page = 1
    while True:
        resp = requests.get(url, headers=_sb_headers(), params={"page": page, "per_page": 50}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        users = data.get("users", [])
        for u in users:
            if u.get("email") == email:
                print(f"  [auth] Found existing user: {email}")
                return u
        if len(users) < 50:
            break
        page += 1
    raise RuntimeError(f"User {email} not found after creation")


def sb_insert(table: str, row: dict) -> dict:
    """Insert a row into a Supabase table. Returns the inserted row."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_sb_headers({"Prefer": "return=representation", "Accept": "application/vnd.pgrst.object+json"}),
        json=row,
        timeout=10,
    )
    if resp.status_code == 409:
        return {}
    resp.raise_for_status()
    return resp.json() if resp.content else {}


def sb_select(table: str, filters: dict) -> list:
    """SELECT rows from a Supabase table with equality filters."""
    params = {k: f"eq.{v}" for k, v in filters.items()}
    params["select"] = "*"
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_sb_headers({"Accept": "application/json"}),
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# NestJS backend helpers
# ---------------------------------------------------------------------------

def api_post(path: str, headers: dict, body: dict) -> dict:
    resp = requests.post(f"{BASE_URL}{path}", headers=headers, json=body, timeout=20)
    if not resp.ok:
        print(f"  [API ERROR] POST {path}: {resp.status_code} {resp.text[:300]}")
    resp.raise_for_status()
    return resp.json()


def api_patch(path: str, headers: dict, body: dict | None = None) -> dict:
    resp = requests.patch(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=20)
    if not resp.ok:
        print(f"  [API ERROR] PATCH {path}: {resp.status_code} {resp.text[:300]}")
    resp.raise_for_status()
    return resp.json()


def api_get(path: str, headers: dict) -> dict:
    resp = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.json()


def login(email: str) -> str:
    """Login via NestJS and return the access token."""
    r = api_post("/auth/login", {}, {"email": email, "password": PASSWORD})
    return r["data"]["accessToken"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

BUYER_EMAIL = "buyer@dubairetailgroup.test"

VENDOR_DEFS = [
    {
        "email": "vendor1@gulfshopfitters.test",
        "company_name": "Gulf Shopfitters LLC",
        "contact_name": "Omar Haddad",
        "category_tags": ["retail-fixtures", "store-fixtures"],
    },
    {
        "email": "vendor2@alnoorretail.test",
        "company_name": "Al Noor Retail Solutions",
        "contact_name": "Fatima Al Suwaidi",
        "category_tags": ["retail-fixtures", "packaging"],
    },
    {
        "email": "vendor3@emiratespos.test",
        "company_name": "Emirates POS Systems",
        "contact_name": "Rashid Khan",
        "category_tags": ["pos-hardware", "electronics"],
    },
    {
        "email": "vendor4@brightstoresupplies.test",
        "company_name": "Bright Store Supplies Co.",
        "contact_name": "Layla Ibrahim",
        "category_tags": ["store-supplies", "packaging"],
    },
]

AUCTION_TITLE = "Adjustable Retail Shelving & Fixtures — Flagship Store Fit-Out"

# (vendor index, bid amount in paise) — monotonically decreasing, each
# respecting amount <= currentBest - minDecrement (minDecrement = 5000)
BID_SEQUENCE = [
    (0, 740000),
    (1, 725000),
    (2, 710000),
    (3, 700000),
    (0, 685000),
    (1, 670000),
    (2, 655000),
]


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def create_buyer() -> dict:
    print("\n[1/6] Creating buyer account...")
    return sb_admin_create_user(
        BUYER_EMAIL,
        PASSWORD,
        "buyer",
        {"full_name": "Aisha Al Mansoori", "company_name": "Dubai Retail Group"},
    )


def create_vendors() -> list[dict]:
    print("\n[2/6] Creating vendor accounts...")
    vendors = []
    for vd in VENDOR_DEFS:
        user = sb_admin_create_user(vd["email"], PASSWORD, "vendor", {"full_name": vd["contact_name"]})

        existing = sb_select("vendors", {"email": vd["email"]})
        if existing:
            vendor_row = existing[0]
            print(f"  [vendors] Existing: {vd['company_name']}")
        else:
            vendor_row = sb_insert("vendors", {
                "user_id": user["id"],
                "company_name": vd["company_name"],
                "contact_name": vd["contact_name"],
                "email": vd["email"],
                "category_tags": vd["category_tags"],
                "status": "APPROVED",
            })
            print(f"  [vendors] Created: {vd['company_name']}")

        vendors.append({"email": vd["email"], "company_name": vd["company_name"], "id": vendor_row["id"]})
    return vendors


def create_and_open_auction(buyer_token: str) -> str:
    print("\n[3/6] Creating auction...")
    bh = bearer(buyer_token)

    existing = sb_select("auctions", {"title": AUCTION_TITLE})
    if existing:
        print(f"  [auction] Existing: {existing[0]['id']} (status: {existing[0]['status']})")
        return existing[0]["id"]

    r = api_post("/auctions", bh, {
        "title": AUCTION_TITLE,
        "description": "Procurement of adjustable shelving units and endcap displays for a new flagship retail store fit-out",
        "category": "retail-fixtures",
        "quantity": 150,
        "unit": "units",
        "type": "REVERSE",
        "ceilingPrice": 750000,
        "minDecrement": 5000,
        "autoExtendEnabled": False,
        "visibility": "PRICE",
    })
    auction_id = r["data"]["id"]
    print(f"  [auction] Created: {auction_id} — waiting 12s for Agent 1 (Price Intelligence)...")
    time.sleep(12)

    api_post(f"/auctions/{auction_id}/lots", bh, {
        "title": "Adjustable Shelving Units + Endcap Displays",
        "quantity": 150,
        "unit": "units",
        "specifications": "Powder-coated steel, adjustable shelf height, matching endcap displays, flagship store branding compatible",
    })

    api_patch(f"/auctions/{auction_id}/publish", bh)
    api_patch(f"/auctions/{auction_id}/open", bh)
    print("  [auction] OPEN")

    return auction_id


def invite_and_accept(buyer_token: str, auction_id: str, vendors: list[dict]) -> None:
    print("\n[4/6] Inviting vendors...")
    bh = bearer(buyer_token)
    vendor_ids = [v["id"] for v in vendors]
    try:
        api_post(f"/auctions/{auction_id}/invitations", bh, {"vendorIds": vendor_ids})
        print("  [invitations] Sent to all 4 vendors")
    except requests.HTTPError:
        print("  [invitations] Already exist")

    print("\n[5/6] Vendors accepting invitations...")
    for v in vendors:
        token = login(v["email"])
        vh = bearer(token)
        r = api_get("/vendor/invitations", vh)
        for inv in r.get("data", []):
            if inv.get("auction_id") == auction_id and inv.get("status") == "INVITED":
                api_patch(f"/vendor/invitations/{inv['id']}/respond", vh, {"status": "ACCEPTED"})
                print(f"  [invitation] {v['company_name']} ACCEPTED")
                break


def submit_bids(auction_id: str, vendors: list[dict]) -> None:
    print("\n[6/6] Submitting bids...")

    existing_bids = sb_select("bids", {"auction_id": auction_id})
    if existing_bids:
        print(f"  [bids] {len(existing_bids)} bids already exist — skipping")
        return

    tokens = [login(v["email"]) for v in vendors]

    for vendor_index, amount in BID_SEQUENCE:
        api_post(f"/auctions/{auction_id}/bids", bearer(tokens[vendor_index]), {"amount": amount})
        print(f"  [bid] {vendors[vendor_index]['company_name']}: {amount} paise")
        time.sleep(1.5)

    print(f"  [bids] Submitted {len(BID_SEQUENCE)} bids — current best: {BID_SEQUENCE[-1][1]} paise")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("  Auction Engine — Sample Auction Seed")
    print(f"  Backend: {BASE_URL}")
    print(f"  Supabase: {SUPABASE_URL}")
    print("=" * 60)

    create_buyer()
    vendors = create_vendors()

    buyer_token = login(BUYER_EMAIL)
    auction_id = create_and_open_auction(buyer_token)
    invite_and_accept(buyer_token, auction_id, vendors)
    submit_bids(auction_id, vendors)

    print("\n" + "=" * 60)
    print("  Sample auction seeded!")
    print(f"  Buyer:   {BUYER_EMAIL} (password: {PASSWORD})")
    for v in vendors:
        print(f"  Vendor:  {v['email']} — {v['company_name']}")
    print(f"  Auction: {auction_id} — OPEN")
    print("=" * 60)


if __name__ == "__main__":
    main()
