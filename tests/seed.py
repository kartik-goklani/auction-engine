#!/usr/bin/env python3
"""
Auction Engine — Supabase Seed Script

Populates Supabase with realistic test data so that:
  - Agent 1 (Price Intelligence) finds historical auction data
  - Agent 2 (Vendor Shortlisting) finds vendors with performance scores
  - Agent 3 (Anomaly Detection) finds a collusion-pattern bid sequence
  - Agent 4 (Award Recommendation) finds a closed auction with bids + AI metadata

Run this ONCE before starting the pytest suite. The script is idempotent —
re-running will skip entities that already exist and refresh .env.test IDs.

Usage:
    cd auction-engine/tests
    cp .env.test.example .env.test       # fill in SUPABASE_URL and SERVICE_ROLE_KEY
    python seed.py
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from dotenv import load_dotenv, set_key

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


def sb_admin_create_user(email: str, password: str, role: str) -> dict:
    """Create a Supabase auth user via Admin API. Returns the user dict."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    resp = requests.post(
        url,
        headers=_sb_headers(),
        json={
            "email": email,
            "password": password,
            "user_metadata": {"role": role},
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


def sb_insert(table: str, row: dict, conflict_col: Optional[str] = None) -> dict:
    """Insert a row into a Supabase table. Returns the inserted row."""
    prefer = "return=representation"
    if conflict_col:
        prefer += f",resolution=ignore-duplicates"

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_sb_headers({"Prefer": prefer, "Accept": "application/vnd.pgrst.object+json"}),
        json=row,
        timeout=10,
    )
    if resp.status_code == 409:
        # Conflict — row exists
        return {}
    resp.raise_for_status()
    return resp.json() if resp.content else {}


def sb_upsert(table: str, row: dict, on_conflict: str) -> dict:
    """Upsert a row into a Supabase table. Returns the upserted row."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_sb_headers({
            "Prefer": f"return=representation,resolution=merge-duplicates",
            "Accept": "application/vnd.pgrst.object+json",
        }),
        params={"on_conflict": on_conflict},
        json=row,
        timeout=10,
    )
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


def sb_update(table: str, filters: dict, data: dict) -> None:
    """UPDATE rows in a Supabase table."""
    params = {k: f"eq.{v}" for k, v in filters.items()}
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_sb_headers({"Prefer": "return=minimal"}),
        params=params,
        json=data,
        timeout=10,
    )
    resp.raise_for_status()


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


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def utc_str(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Phase 1 — Direct Supabase: users, vendors, performance, history
# ---------------------------------------------------------------------------

def phase1_users() -> dict:
    """Create all test users and vendor records. Returns map of email → user."""
    print("\n[Phase 1a] Creating auth users...")
    users = {}
    accounts = [
        ("buyer1@aitt.test", "buyer"),
        ("buyer2@aitt.test", "buyer"),
        ("vendor1@aitt.test", "vendor"),
        ("vendor2@aitt.test", "vendor"),
        ("vendor3@aitt.test", "vendor"),
        ("vendor4@aitt.test", "vendor"),
    ]
    for email, role in accounts:
        users[email] = sb_admin_create_user(email, PASSWORD, role)
    return users


def phase1_vendors(users: dict) -> dict:
    """Create vendor rows in the vendors table. Returns map of email → vendor_id."""
    print("\n[Phase 1b] Creating vendor records...")
    vendor_defs = [
        {
            "email": "vendor1@aitt.test",
            "company_name": "Acme Office Supplies",
            "contact_name": "Ravi Kumar",
            "category_tags": ["office-supplies", "stationery"],
            "status": "APPROVED",
        },
        {
            "email": "vendor2@aitt.test",
            "company_name": "TechMart India",
            "contact_name": "Priya Nair",
            "category_tags": ["office-supplies", "electronics"],
            "status": "APPROVED",
        },
        {
            "email": "vendor3@aitt.test",
            "company_name": "Global Stationery Ltd",
            "contact_name": "Arjun Mehta",
            "category_tags": ["stationery", "office-supplies"],
            "status": "APPROVED",
        },
        {
            "email": "vendor4@aitt.test",
            "company_name": "Budget Office Solutions",
            "contact_name": "Sunita Sharma",
            "category_tags": ["office-supplies"],
            "status": "APPROVED",
        },
    ]

    vendor_ids = {}
    for vd in vendor_defs:
        email = vd["email"]
        user_id = users[email]["id"]

        # Check if vendor row already exists
        existing = sb_select("vendors", {"email": email})
        if existing:
            vendor_ids[email] = existing[0]["id"]
            print(f"  [vendors] Existing: {vd['company_name']}")
        else:
            row = {
                "user_id": user_id,
                "company_name": vd["company_name"],
                "contact_name": vd["contact_name"],
                "email": email,
                "category_tags": vd["category_tags"],
                "status": vd["status"],
            }
            inserted = sb_insert("vendors", row)
            vendor_ids[email] = inserted["id"]
            print(f"  [vendors] Created: {vd['company_name']}")

    return vendor_ids


def phase1_performance_scores(vendor_ids: dict) -> None:
    """Insert vendor_performance_scores for Agent 2 to find."""
    print("\n[Phase 1c] Creating vendor performance scores...")
    scores = [
        {
            "email": "vendor1@aitt.test",
            "category": "office-supplies",
            "delivery_success_rate": 96.00,
            "quality_score": 4.5,
            "total_contracts": 45,
            "defaulted_contracts": 1,
        },
        {
            "email": "vendor1@aitt.test",
            "category": "stationery",
            "delivery_success_rate": 94.00,
            "quality_score": 4.3,
            "total_contracts": 18,
            "defaulted_contracts": 0,
        },
        {
            "email": "vendor2@aitt.test",
            "category": "office-supplies",
            "delivery_success_rate": 88.00,
            "quality_score": 3.9,
            "total_contracts": 23,
            "defaulted_contracts": 2,
        },
        {
            "email": "vendor3@aitt.test",
            "category": "stationery",
            "delivery_success_rate": 92.00,
            "quality_score": 4.2,
            "total_contracts": 31,
            "defaulted_contracts": 1,
        },
        {
            "email": "vendor3@aitt.test",
            "category": "office-supplies",
            "delivery_success_rate": 90.00,
            "quality_score": 4.0,
            "total_contracts": 12,
            "defaulted_contracts": 0,
        },
        {
            "email": "vendor4@aitt.test",
            "category": "office-supplies",
            "delivery_success_rate": 78.00,
            "quality_score": 3.5,
            "total_contracts": 12,
            "defaulted_contracts": 3,
        },
    ]

    for s in scores:
        v_id = vendor_ids[s["email"]]
        existing = sb_select("vendor_performance_scores", {"vendor_id": v_id, "category": s["category"]})
        if not existing:
            sb_insert("vendor_performance_scores", {
                "vendor_id": v_id,
                "category": s["category"],
                "delivery_success_rate": s["delivery_success_rate"],
                "quality_score": s["quality_score"],
                "total_contracts": s["total_contracts"],
                "defaulted_contracts": s["defaulted_contracts"],
            })
            print(f"  [perf] {s['email']} / {s['category']}")
        else:
            print(f"  [perf] Existing: {s['email']} / {s['category']}")


def phase1_historical_auctions(buyer1_id: str, vendor_ids: dict) -> None:
    """
    Create 3 historical AWARDED auctions in 'office-supplies' so Agent 1
    (Price Intelligence) finds real data when querying get_historical_auction_data.
    """
    print("\n[Phase 1d] Creating historical AWARDED auctions...")

    v1 = vendor_ids["vendor1@aitt.test"]
    v2 = vendor_ids["vendor2@aitt.test"]
    v3 = vendor_ids["vendor3@aitt.test"]

    history = [
        {
            "title": "[SEED] Office Chairs Q3 2025",
            "created_days_ago": 21,
            "ceiling": 500000,
            "bid_amounts": [490000, 480000, 465000, 450000, 435000, 420000],
            "bid_vendors": [v1, v2, v1, v3, v2, v1],
        },
        {
            "title": "[SEED] Stationery Bulk Q4 2025",
            "created_days_ago": 14,
            "ceiling": 300000,
            "bid_amounts": [295000, 280000, 270000, 258000, 245000, 235000],
            "bid_vendors": [v2, v1, v3, v1, v3, v2],
        },
        {
            "title": "[SEED] Printer Paper Annual 2026",
            "created_days_ago": 7,
            "ceiling": 200000,
            "bid_amounts": [198000, 190000, 182000, 175000, 168000],
            "bid_vendors": [v3, v1, v2, v3, v1],
        },
    ]

    for h in history:
        existing = sb_select("auctions", {"title": h["title"]})
        if existing:
            print(f"  [history] Existing: {h['title']}")
            auction_id = existing[0]["id"]
        else:
            created = now_utc() - timedelta(days=h["created_days_ago"])
            opened = created + timedelta(hours=1)
            closed = created + timedelta(days=1)

            auction_row = {
                "title": h["title"],
                "description": "Seeded historical auction for AI agent testing",
                "category": "office-supplies",
                "type": "REVERSE",
                "status": "AWARDED",
                "buyer_id": buyer1_id,
                "start_time": utc_str(opened),
                "end_time": utc_str(closed),
                "ceiling_price": h["ceiling"],
                "min_decrement": 5000,
                "auto_extend_enabled": False,
                "visibility": "PRICE",
                "created_at": utc_str(created),
                "updated_at": utc_str(closed),
            }
            inserted = sb_insert("auctions", auction_row)
            auction_id = inserted["id"]
            print(f"  [history] Created: {h['title']}")

        # Insert bids — check first
        existing_bids = sb_select("bids", {"auction_id": auction_id})
        if not existing_bids:
            bid_time = now_utc() - timedelta(days=h["created_days_ago"] - 1, hours=2)
            for i, (amount, v_id) in enumerate(zip(h["bid_amounts"], h["bid_vendors"])):
                sb_insert("bids", {
                    "auction_id": auction_id,
                    "vendor_id": v_id,
                    "amount": amount,
                    "status": "ACCEPTED",
                    "submitted_at": utc_str(bid_time + timedelta(minutes=i * 15)),
                })
            print(f"    [bids] Inserted {len(h['bid_amounts'])} historical bids")


# ---------------------------------------------------------------------------
# Phase 2 — NestJS API: live test auctions
# ---------------------------------------------------------------------------

def phase2_auction_a(buyer1_token: str, vendor_ids: dict) -> str:
    """
    Auction A: REVERSE, OPEN, office-supplies.
    Has 12 bids including a collusion pattern for Agent 3.
    Returns auction_id.
    """
    print("\n[Phase 2a] Creating Auction A (OPEN REVERSE)...")
    bh = bearer(buyer1_token)

    existing = sb_select("auctions", {"title": "Auction A — Office Chairs Procurement"})
    if existing and existing[0]["status"] == "OPEN":
        auction_id = existing[0]["id"]
        print(f"  [auction_a] Existing OPEN auction: {auction_id}")
    else:
        # Create
        r = api_post("/auctions", bh, {
            "title": "Auction A — Office Chairs Procurement",
            "description": "Procurement of ergonomic office chairs for 200 employees",
            "category": "office-supplies",
            "type": "REVERSE",
            "ceilingPrice": 500000,
            "minDecrement": 5000,
            "autoExtendEnabled": False,
            "visibility": "PRICE",
        })
        auction_id = r["data"]["id"]
        print(f"  [auction_a] Created: {auction_id} — waiting 12s for Agent 1...")
        time.sleep(12)

        # Add a lot
        api_post(f"/auctions/{auction_id}/lots", bh, {
            "title": "Ergonomic Chair — Model X200",
            "quantity": 200,
            "unit": "units",
            "specifications": "Lumbar support, adjustable armrests, 5-year warranty",
        })

        # Publish → Open
        api_patch(f"/auctions/{auction_id}/publish", bh)
        api_patch(f"/auctions/{auction_id}/open", bh)
        print(f"  [auction_a] OPEN")

    # Invite vendors (idempotent — duplicates are ignored by the backend)
    v1 = vendor_ids["vendor1@aitt.test"]
    v2 = vendor_ids["vendor2@aitt.test"]
    v3 = vendor_ids["vendor3@aitt.test"]
    v4 = vendor_ids["vendor4@aitt.test"]
    try:
        api_post(f"/auctions/{auction_id}/invitations", bh, {"vendorIds": [v1, v2, v3, v4]})
        print(f"  [auction_a] Vendors invited")
    except Exception:
        print(f"  [auction_a] Invitations already exist")

    # Vendors accept
    _vendor_accept_all_invitations("vendor1@aitt.test", auction_id)
    _vendor_accept_all_invitations("vendor2@aitt.test", auction_id)
    _vendor_accept_all_invitations("vendor3@aitt.test", auction_id)
    _vendor_accept_all_invitations("vendor4@aitt.test", auction_id)

    # Insert collusion-pattern bids directly (bypasses rate limiter, custom timestamps)
    _seed_auction_a_bids(auction_id, vendor_ids)

    return auction_id


def _seed_auction_a_bids(auction_id: str, vendor_ids: dict) -> None:
    """
    Insert 12 bids with a collusion pattern (vendor1 and vendor2 alternating
    within 2s of each other × 6 rounds). This triggers Agent 3's collusion detector.
    Bids are timestamped 2 hours ago so they don't interfere with live bid tests.
    """
    v1 = vendor_ids["vendor1@aitt.test"]
    v2 = vendor_ids["vendor2@aitt.test"]
    v3 = vendor_ids["vendor3@aitt.test"]
    v4 = vendor_ids["vendor4@aitt.test"]

    existing = sb_select("bids", {"auction_id": auction_id})
    if existing:
        print(f"  [auction_a bids] {len(existing)} bids already exist — skipping")
        return

    # Base time: 2 hours ago
    t0 = now_utc() - timedelta(hours=2)

    # First 4 bids: normal opening bids from v3 and v4
    opening_bids = [
        (v3, 490000, t0),
        (v4, 480000, t0 + timedelta(minutes=5)),
        (v3, 472000, t0 + timedelta(minutes=10)),
        (v4, 465000, t0 + timedelta(minutes=15)),
    ]
    for vendor_id, amount, ts in opening_bids:
        sb_insert("bids", {
            "auction_id": auction_id,
            "vendor_id": vendor_id,
            "amount": amount,
            "status": "ACCEPTED",
            "submitted_at": utc_str(ts),
        })
        sb_insert("audit_logs", {
            "auction_id": auction_id,
            "actor_id": vendor_id,
            "actor_type": "VENDOR",
            "action": "BID_ACCEPTED",
            "metadata": {"amount": amount},
            "created_at": utc_str(ts),
        })

    # Next 8 bids: collusion pattern — v1 and v2 alternating every 2 seconds
    # This creates 3 matching 4-tuples (collusionPairsFound >= 2 = threshold)
    collusion_base = t0 + timedelta(minutes=20)
    collusion_bids = [
        (v1, 458000, collusion_base),
        (v2, 450000, collusion_base + timedelta(seconds=2)),
        (v1, 442000, collusion_base + timedelta(seconds=4)),
        (v2, 434000, collusion_base + timedelta(seconds=6)),
        (v1, 426000, collusion_base + timedelta(seconds=8)),
        (v2, 418000, collusion_base + timedelta(seconds=10)),
        (v1, 410000, collusion_base + timedelta(seconds=12)),
        (v2, 402000, collusion_base + timedelta(seconds=14)),
    ]
    for vendor_id, amount, ts in collusion_bids:
        sb_insert("bids", {
            "auction_id": auction_id,
            "vendor_id": vendor_id,
            "amount": amount,
            "status": "ACCEPTED",
            "submitted_at": utc_str(ts),
        })
        sb_insert("audit_logs", {
            "auction_id": auction_id,
            "actor_id": vendor_id,
            "actor_type": "VENDOR",
            "action": "BID_ACCEPTED",
            "metadata": {"amount": amount},
            "created_at": utc_str(ts),
        })

    print(f"  [auction_a bids] Inserted 12 bids + audit logs (4 normal + 8 collusion-pattern)")

    # Ensure auction_ai_metadata exists for Auction A (Agent 3 reads it)
    existing_meta = sb_select("auction_ai_metadata", {"auction_id": auction_id})
    if not existing_meta:
        sb_upsert("auction_ai_metadata", {
            "auction_id": auction_id,
            "ceiling_price": 500000,
            "suggested_decrement": 8000,
            "risk_threshold": 300000,
            "risk_note": "Based on 3 historical auctions in office-supplies category",
            "confidence_level": "HIGH",
        }, on_conflict="auction_id")
        print(f"  [auction_a] Inserted auction_ai_metadata")


def phase2_auction_b(buyer1_token: str, vendor_ids: dict) -> str:
    """
    Auction B: FORWARD, CLOSED, stationery.
    Has 5 accepted bids. Award Recommendation agent runs on close.
    Returns auction_id.
    """
    print("\n[Phase 2b] Creating Auction B (CLOSED FORWARD)...")
    bh = bearer(buyer1_token)

    existing = sb_select("auctions", {"title": "Auction B — Art Supply Surplus Sale"})
    if existing and existing[0]["status"] == "CLOSED":
        auction_id = existing[0]["id"]
        print(f"  [auction_b] Existing CLOSED auction: {auction_id}")
        return auction_id

    # Create
    end_time = now_utc() + timedelta(hours=1)
    r = api_post("/auctions", bh, {
        "title": "Auction B — Art Supply Surplus Sale",
        "description": "Forward auction for art supply surplus stock",
        "category": "stationery",
        "type": "FORWARD",
        "ceilingPrice": 200000,
        "minDecrement": 2000,
        "autoExtendEnabled": False,
        "visibility": "RANK",
        "endTime": end_time.isoformat(),
    })
    auction_id = r["data"]["id"]
    print(f"  [auction_b] Created: {auction_id} — waiting 10s for Agent 1...")
    time.sleep(10)

    # Publish → Open
    api_patch(f"/auctions/{auction_id}/publish", bh)
    api_patch(f"/auctions/{auction_id}/open", bh)

    # Invite v1, v2, v3 (not v4)
    v1 = vendor_ids["vendor1@aitt.test"]
    v2 = vendor_ids["vendor2@aitt.test"]
    v3 = vendor_ids["vendor3@aitt.test"]
    api_post(f"/auctions/{auction_id}/invitations", bh, {"vendorIds": [v1, v2, v3]})

    # Vendors accept
    _vendor_accept_all_invitations("vendor1@aitt.test", auction_id)
    _vendor_accept_all_invitations("vendor2@aitt.test", auction_id)
    _vendor_accept_all_invitations("vendor3@aitt.test", auction_id)

    # Submit bids (FORWARD: higher is better)
    v1_token = login("vendor1@aitt.test")
    v2_token = login("vendor2@aitt.test")
    v3_token = login("vendor3@aitt.test")

    api_post(f"/auctions/{auction_id}/bids", bearer(v3_token), {"amount": 160000})
    time.sleep(0.5)
    api_post(f"/auctions/{auction_id}/bids", bearer(v2_token), {"amount": 172000})
    time.sleep(0.5)
    api_post(f"/auctions/{auction_id}/bids", bearer(v1_token), {"amount": 185000})
    time.sleep(0.5)
    api_post(f"/auctions/{auction_id}/bids", bearer(v3_token), {"amount": 191000})
    time.sleep(0.5)
    api_post(f"/auctions/{auction_id}/bids", bearer(v1_token), {"amount": 198000})
    print(f"  [auction_b] Submitted 5 bids — v1 leads at ₹1,980")

    # Close → triggers Agent 4
    api_patch(f"/auctions/{auction_id}/close", bh)
    print(f"  [auction_b] CLOSED — waiting 20s for Agent 4 (Award Recommendation)...")
    time.sleep(20)
    print(f"  [auction_b] Done")

    return auction_id


def phase2_auction_c(buyer1_token: str, vendor_ids: dict) -> str:
    """
    Auction C: SEALED_BID, PUBLISHED.
    v2 invited and accepted, v4 invited but not responded.
    Returns auction_id.
    """
    print("\n[Phase 2c] Creating Auction C (PUBLISHED SEALED_BID)...")
    bh = bearer(buyer1_token)

    existing = sb_select("auctions", {"title": "Auction C — IT Equipment Procurement"})
    if existing and existing[0]["status"] in ("PUBLISHED", "OPEN"):
        auction_id = existing[0]["id"]
        print(f"  [auction_c] Existing: {auction_id}")
        return auction_id

    r = api_post("/auctions", bh, {
        "title": "Auction C — IT Equipment Procurement",
        "description": "Sealed bid auction for IT hardware procurement",
        "category": "electronics",
        "type": "SEALED_BID",
        "ceilingPrice": 1000000,
        "minDecrement": 0,
        "autoExtendEnabled": False,
        "visibility": "BLIND",
    })
    auction_id = r["data"]["id"]
    print(f"  [auction_c] Created: {auction_id}")

    v2 = vendor_ids["vendor2@aitt.test"]
    v4 = vendor_ids["vendor4@aitt.test"]
    api_post(f"/auctions/{auction_id}/invitations", bh, {"vendorIds": [v2, v4]})

    # v2 accepts; v4 leaves as INVITED (not responded)
    _vendor_accept_all_invitations("vendor2@aitt.test", auction_id)

    # Publish
    api_patch(f"/auctions/{auction_id}/publish", bh)
    print(f"  [auction_c] PUBLISHED")

    return auction_id


def _vendor_accept_all_invitations(email: str, auction_id: str) -> None:
    """Log in as vendor, find invitation for auction_id, accept it if INVITED."""
    token = login(email)
    bh = bearer(token)
    r = api_get("/vendor/invitations", bh)
    invitations = r.get("data", [])
    for inv in invitations:
        if inv.get("auction_id") == auction_id and inv.get("status") == "INVITED":
            api_patch(f"/vendor/invitations/{inv['id']}/respond", bh, {"status": "ACCEPTED"})
            print(f"  [invitation] {email} ACCEPTED invitation to {auction_id[:8]}...")
            return
    # Already responded or no invitation found — skip silently


# ---------------------------------------------------------------------------
# Write results to .env.test
# ---------------------------------------------------------------------------

def write_env(key: str, value: str) -> None:
    set_key(".env.test", key, value)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("  Auction Engine — Seed Script")
    print(f"  Backend: {BASE_URL}")
    print(f"  Supabase: {SUPABASE_URL}")
    print("=" * 60)

    # --- Phase 1 ---
    users = phase1_users()
    vendor_ids = phase1_vendors(users)
    phase1_performance_scores(vendor_ids)

    buyer1_id = users["buyer1@aitt.test"]["id"]
    phase1_historical_auctions(buyer1_id, vendor_ids)

    # --- Phase 2 ---
    print("\n[Phase 2] NestJS backend operations (backend must be running on port 3001)...")
    buyer1_token = login("buyer1@aitt.test")

    auction_a_id = phase2_auction_a(buyer1_token, vendor_ids)
    auction_b_id = phase2_auction_b(buyer1_token, vendor_ids)
    auction_c_id = phase2_auction_c(buyer1_token, vendor_ids)

    # --- Write .env.test ---
    print("\n[Seed] Writing entity IDs to .env.test...")
    write_env("VENDOR1_ID", vendor_ids["vendor1@aitt.test"])
    write_env("VENDOR2_ID", vendor_ids["vendor2@aitt.test"])
    write_env("VENDOR3_ID", vendor_ids["vendor3@aitt.test"])
    write_env("VENDOR4_ID", vendor_ids["vendor4@aitt.test"])
    write_env("AUCTION_OPEN_ID", auction_a_id)
    write_env("AUCTION_CLOSED_ID", auction_b_id)
    write_env("AUCTION_PUBLISHED_ID", auction_c_id)

    # --- Summary ---
    print("\n" + "=" * 60)
    print("  Seed complete!")
    print(f"  Vendor 1 (Acme):    {vendor_ids['vendor1@aitt.test']}")
    print(f"  Vendor 2 (TechMart):{vendor_ids['vendor2@aitt.test']}")
    print(f"  Vendor 3 (Global):  {vendor_ids['vendor3@aitt.test']}")
    print(f"  Vendor 4 (Budget):  {vendor_ids['vendor4@aitt.test']}")
    print(f"  Auction A (OPEN):   {auction_a_id}")
    print(f"  Auction B (CLOSED): {auction_b_id}")
    print(f"  Auction C (PUBL):   {auction_c_id}")
    print("=" * 60)
    print("\nNext: pytest -v --tb=short")


if __name__ == "__main__":
    main()
