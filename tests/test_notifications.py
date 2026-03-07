"""
test_notifications.py — Notification endpoint E2E tests.

Seeded actions (auction creation, invitations, bid accepts) generate
in-app notifications that these tests verify.

Covers:
  - GET /notifications
  - PATCH /notifications/:id/read
  - PATCH /notifications/read-all
"""

import pytest
import requests

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)


def patch(path: str, headers: dict, body: dict | None = None) -> requests.Response:
    return requests.patch(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=15)


class TestListNotifications:
    def test_vendor_can_list_notifications(self, vendor1_headers):
        resp = get("/notifications", vendor1_headers)
        assert resp.status_code == 200
        notifications = resp.json()["data"]
        assert isinstance(notifications, list)

    def test_buyer_can_list_notifications(self, buyer1_headers):
        resp = get("/notifications", buyer1_headers)
        assert resp.status_code == 200
        notifications = resp.json()["data"]
        assert isinstance(notifications, list)

    def test_unauthenticated_cannot_list_notifications(self):
        resp = get("/notifications", {})
        assert resp.status_code == 401

    def test_notifications_have_expected_fields(self, vendor1_headers):
        resp = get("/notifications", vendor1_headers)
        notifications = resp.json()["data"]
        if not notifications:
            pytest.skip("No notifications for vendor1 — check seed data")
        n = notifications[0]
        assert "id" in n
        assert "type" in n
        assert "title" in n
        assert "read" in n
        assert isinstance(n["read"], bool)
        assert "created_at" in n

    def test_notifications_include_invitation_received(self, vendor1_headers):
        """Seeded invitations generate INVITATION_RECEIVED notifications."""
        resp = get("/notifications", vendor1_headers)
        notifications = resp.json()["data"]
        types = [n["type"] for n in notifications]
        assert "INVITATION_RECEIVED" in types, (
            "Expected INVITATION_RECEIVED notification — check seed data generated invitations"
        )


class TestMarkRead:
    def test_mark_single_notification_as_read(self, vendor1_headers):
        resp = get("/notifications", vendor1_headers)
        notifications = resp.json()["data"]
        unread = [n for n in notifications if not n["read"]]
        if not unread:
            pytest.skip("No unread notifications to mark")

        notif_id = unread[0]["id"]
        mark_resp = patch(f"/notifications/{notif_id}/read", vendor1_headers)
        assert mark_resp.status_code == 204

        # Verify it's now read
        check_resp = get("/notifications", vendor1_headers)
        updated = next(
            (n for n in check_resp.json()["data"] if n["id"] == notif_id),
            None,
        )
        if updated:
            assert updated["read"] is True

    def test_mark_all_notifications_as_read(self, buyer1_headers):
        resp = patch("/notifications/read-all", buyer1_headers)
        assert resp.status_code == 204

        # All buyer1 notifications should now be read
        check_resp = get("/notifications", buyer1_headers)
        notifications = check_resp.json()["data"]
        unread = [n for n in notifications if not n["read"]]
        assert len(unread) == 0

    def test_mark_read_requires_auth(self):
        resp = patch("/notifications/00000000-0000-4000-8000-000000000001/read", {})
        assert resp.status_code == 401

    def test_mark_all_read_requires_auth(self):
        resp = patch("/notifications/read-all", {})
        assert resp.status_code == 401
