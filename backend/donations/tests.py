from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Donation, PickupRequest


class DonationFlowTests(APITestCase):
    def setUp(self):
        self.donor = User.objects.create_user("donor@test.com", "pass12345", name="Donor", role="donor", phone="111")
        self.ngo = User.objects.create_user("ngo@test.com", "pass12345", name="NGO", role="ngo", phone="222")
        self.ngo2 = User.objects.create_user("ngo2@test.com", "pass12345", name="NGO Two", role="ngo", phone="333")

    def food_payload(self, **extra):
        data = {
            "donation_type": "food",
            "title": "Veg biryani",
            "quantity": 20,
            "location": "MG Road",
            "expiry": (timezone.now() + timedelta(hours=5)).isoformat(),
        }
        data.update(extra)
        return data

    def test_register_cannot_create_admin(self):
        res = self.client.post(
            "/api/auth/register/",
            {"name": "Sneaky", "email": "s@test.com", "password": "pass12345!x", "role": "admin"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_food_requires_future_expiry(self):
        self.client.force_authenticate(self.donor)
        res = self.client.post("/api/donations/", self.food_payload(expiry=None), format="json")
        self.assertEqual(res.status_code, 400)
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        res = self.client.post("/api/donations/", self.food_payload(expiry=past), format="json")
        self.assertEqual(res.status_code, 400)

    def test_clothes_require_condition(self):
        self.client.force_authenticate(self.donor)
        payload = {"donation_type": "clothes", "title": "Jackets", "quantity": 5, "location": "Indiranagar"}
        self.assertEqual(self.client.post("/api/donations/", payload, format="json").status_code, 400)
        payload["condition"] = "good"
        self.assertEqual(self.client.post("/api/donations/", payload, format="json").status_code, 201)

    def test_ngo_cannot_create_donation(self):
        self.client.force_authenticate(self.ngo)
        self.assertEqual(self.client.post("/api/donations/", self.food_payload(), format="json").status_code, 403)

    def test_full_pickup_and_qr_flow(self):
        self.client.force_authenticate(self.donor)
        donation_id = self.client.post("/api/donations/", self.food_payload(), format="json").data["id"]

        # Two NGOs request; the first one is accepted, the other is auto-rejected.
        self.client.force_authenticate(self.ngo)
        pickup_id = self.client.post("/api/pickups/", {"donation": donation_id}, format="json").data["id"]
        self.assertEqual(
            self.client.post("/api/pickups/", {"donation": donation_id}, format="json").status_code, 400
        )  # duplicate request
        self.client.force_authenticate(self.ngo2)
        other_pickup_id = self.client.post("/api/pickups/", {"donation": donation_id}, format="json").data["id"]

        # Phone numbers stay hidden while pending
        self.client.force_authenticate(self.donor)
        res = self.client.get(f"/api/pickups/{pickup_id}/")
        self.assertIsNone(res.data["contact"])

        self.assertEqual(self.client.post(f"/api/pickups/{pickup_id}/accept/").status_code, 200)
        self.assertEqual(PickupRequest.objects.get(pk=other_pickup_id).status, "rejected")
        self.assertEqual(Donation.objects.get(pk=donation_id).status, "reserved")
        self.assertEqual(self.client.get(f"/api/pickups/{pickup_id}/").data["contact"]["phone"], "222")

        # Only the accepted NGO can create a QR token
        self.client.force_authenticate(self.ngo2)
        self.assertEqual(self.client.post(f"/api/pickups/{pickup_id}/qr/").status_code, 404)
        self.client.force_authenticate(self.ngo)
        token = self.client.post(f"/api/pickups/{pickup_id}/qr/").data["token"]

        # Donor scans it: completes. Scanning again fails.
        self.client.force_authenticate(self.donor)
        self.assertEqual(self.client.post("/api/pickups/verify-qr/", {"token": token}, format="json").status_code, 200)
        self.assertEqual(Donation.objects.get(pk=donation_id).status, "completed")
        self.assertEqual(self.client.post("/api/pickups/verify-qr/", {"token": token}, format="json").status_code, 400)

    def test_qr_rejected_for_wrong_donor(self):
        stranger = User.objects.create_user("x@test.com", "pass12345", name="X", role="donor")
        self.client.force_authenticate(self.donor)
        donation_id = self.client.post("/api/donations/", self.food_payload(), format="json").data["id"]
        self.client.force_authenticate(self.ngo)
        pickup_id = self.client.post("/api/pickups/", {"donation": donation_id}, format="json").data["id"]
        self.client.force_authenticate(self.donor)
        self.client.post(f"/api/pickups/{pickup_id}/accept/")
        self.client.force_authenticate(self.ngo)
        token = self.client.post(f"/api/pickups/{pickup_id}/qr/").data["token"]
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.post("/api/pickups/verify-qr/", {"token": token}, format="json").status_code, 400)
