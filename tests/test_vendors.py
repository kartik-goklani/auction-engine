"""
test_vendors.py — Vendor directory and invitation flow E2E tests.

Covers:
  - GET /vendors (buyer views all APPROVED vendors)
  - GET /vendors/:id (vendor detail with performance scores)
  - GET /vendor/profile, PATCH /vendor/profile
  - POST /auctions/:id/invitations
  - GET /auctions/:id/invitations
  - GET /vendor/invitations
  - PATCH /vendor/invitations/:id/respond
  - DELETE /auctions/:id/invitations/:vendorId
"""

import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)


def post(path: str, headers: dict, body: dict) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", headers=headers, json=body, timeout=15)


def patch(path: str, headers: dict, body: dict) -> requests.Response:
    return requests.patch(f"{BASE_URL}{path}", headers=headers, json=body, timeout=15)


def delete(path: str, headers: dict) -> requests.Response:
    return requests.delete(f"{BASE_URL}{path}", headers=headers, timeout=15)


class TestVendorDirectory:
    def test_buyer_can_list_approved_vendors(self, buyer1_headers):
        resp = get("/vendors", buyer1_headers)
        assert resp.status_code == 200
        vendors = resp.json()["data"]
        assert isinstance(vendors, list)
        assert len(vendors) >= 4  # at least the 4 seeded vendors
        statuses = {v["status"] for v in vendors}
        assert statuses == {"APPROVED"}  # only APPROVED vendors returned

    def test_vendor_cannot_list_vendor_directory(self, vendor1_headers):
        resp = get("/vendors", vendor1_headers)
        assert resp.status_code == 403

    def test_buyer_can_get_vendor_detail_with_performance(self, buyer1_headers, vendor1_id):
        resp = get(f"/vendors/{vendor1_id}", buyer1_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == vendor1_id
        assert "performance_scores" in data
        assert isinstance(data["performance_scores"], list)
        assert len(data["performance_scores"]) > 0

    def test_buyer_get_nonexistent_vendor_returns_404(self, buyer1_headers):
        resp = get("/vendors/00000000-0000-4000-8000-000000000099", buyer1_headers)
        assert resp.status_code == 404


class TestVendorProfile:
    def test_vendor_can_get_own_profile(self, vendor1_headers):
        resp = get("/vendor/profile", vendor1_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "vendor1@aitt.test"
        assert data["company_name"] == "Acme Office Supplies"

    def test_buyer_cannot_access_vendor_profile_endpoint(self, buyer1_headers):
        resp = get("/vendor/profile", buyer1_headers)
        assert resp.status_code == 403

    def test_vendor_can_update_own_profile(self, vendor1_headers):
        resp = patch("/vendor/profile", vendor1_headers, {
            "contactName": "Ravi Kumar Updated",
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["contact_name"] == "Ravi Kumar Updated"

    def test_vendor_cannot_update_another_vendors_profile(self, vendor2_headers):
        # The endpoint only returns the current user's vendor — no targeting another vendor
        resp = patch("/vendor/profile", vendor2_headers, {
            "companyName": "Hacked Company Name",
        })
        # Should update vendor2's own profile (not vendor1's) — assert it's vendor2
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == "vendor2@aitt.test"


class TestInvitationFlow:
    """
    Uses vendor_test_auction_id — a fresh DRAFT auction created per test session.
    Tests run in order: invite → view → accept → decline → re-respond (error).
    """

    def test_buyer_can_invite_vendors(self, buyer1_headers, vendor_test_auction_id,
                                      vendor1_id, vendor2_id):
        resp = post(
            f"/auctions/{vendor_test_auction_id}/invitations",
            buyer1_headers,
            {"vendorIds": [vendor1_id, vendor2_id]},
        )
        assert resp.status_code == 201

    def test_buyer_can_list_invitations(self, buyer1_headers, vendor_test_auction_id):
        resp = get(f"/auctions/{vendor_test_auction_id}/invitations", buyer1_headers)
        assert resp.status_code == 200
        invitations = resp.json()["data"]
        assert isinstance(invitations, list)
        assert len(invitations) >= 2
        statuses = {inv["status"] for inv in invitations}
        assert "INVITED" in statuses

    def test_vendor_can_see_own_invitation(self, vendor1_headers, vendor_test_auction_id):
        resp = get("/vendor/invitations", vendor1_headers)
        assert resp.status_code == 200
        invitations = resp.json()["data"]
        auction_ids = [inv["auction_id"] for inv in invitations]
        assert vendor_test_auction_id in auction_ids

    def test_vendor_can_accept_invitation(self, vendor1_headers, vendor_test_auction_id):
        resp = get("/vendor/invitations", vendor1_headers)
        inv = next(
            (i for i in resp.json()["data"]
             if i["auction_id"] == vendor_test_auction_id and i["status"] == "INVITED"),
            None,
        )
        assert inv is not None, "No INVITED invitation found for vendor1"

        accept_resp = patch(
            f"/vendor/invitations/{inv['id']}/respond",
            vendor1_headers,
            {"status": "ACCEPTED"},
        )
        assert accept_resp.status_code == 200
        assert accept_resp.json()["data"]["status"] == "ACCEPTED"

    def test_vendor_can_decline_invitation(self, vendor2_headers, vendor_test_auction_id):
        resp = get("/vendor/invitations", vendor2_headers)
        inv = next(
            (i for i in resp.json()["data"]
             if i["auction_id"] == vendor_test_auction_id and i["status"] == "INVITED"),
            None,
        )
        assert inv is not None, "No INVITED invitation found for vendor2"

        decline_resp = patch(
            f"/vendor/invitations/{inv['id']}/respond",
            vendor2_headers,
            {"status": "DECLINED"},
        )
        assert decline_resp.status_code == 200
        assert decline_resp.json()["data"]["status"] == "DECLINED"

    def test_vendor_cannot_re_respond_to_already_answered_invitation(
        self, vendor1_headers, vendor_test_auction_id
    ):
        resp = get("/vendor/invitations", vendor1_headers)
        inv = next(
            (i for i in resp.json()["data"]
             if i["auction_id"] == vendor_test_auction_id),
            None,
        )
        assert inv is not None
        # vendor1 already ACCEPTED — try again
        re_resp = patch(
            f"/vendor/invitations/{inv['id']}/respond",
            vendor1_headers,
            {"status": "DECLINED"},
        )
        assert re_resp.status_code == 422

    def test_invite_vendors_with_empty_list_fails(self, buyer1_headers, vendor_test_auction_id):
        resp = post(
            f"/auctions/{vendor_test_auction_id}/invitations",
            buyer1_headers,
            {"vendorIds": []},
        )
        assert resp.status_code == 400

    def test_buyer_can_revoke_invitation_in_draft(self, buyer1_headers, vendor_test_auction_id,
                                                    vendor3_id):
        # Invite vendor3 first
        post(
            f"/auctions/{vendor_test_auction_id}/invitations",
            buyer1_headers,
            {"vendorIds": [vendor3_id]},
        )
        # Revoke
        resp = delete(
            f"/auctions/{vendor_test_auction_id}/invitations/{vendor3_id}",
            buyer1_headers,
        )
        assert resp.status_code == 204
