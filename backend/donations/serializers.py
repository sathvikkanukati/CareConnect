from django.utils import timezone
from rest_framework import serializers

from .models import Donation, DonationType, NGONeed, PickupRequest


class DonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)

    class Meta:
        model = Donation
        fields = (
            "id", "donor", "donor_name", "donation_type", "title", "category", "description",
            "quantity", "quantity_unit", "condition", "size_or_age_group", "location",
            "latitude", "longitude", "expiry", "image_url", "status", "created_at", "updated_at",
        )
        read_only_fields = ("id", "donor", "status", "created_at", "updated_at")

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        def current(key):
            if key in attrs:
                return attrs[key]
            return getattr(self.instance, key, None) if self.instance else None

        dtype = current("donation_type")
        if dtype == DonationType.FOOD:
            expiry = current("expiry")
            if not expiry:
                raise serializers.ValidationError({"expiry": "Expiry is required for food donations."})
            if "expiry" in attrs and expiry <= timezone.now():
                raise serializers.ValidationError({"expiry": "Expiry must be in the future."})
            if not attrs.get("quantity_unit") and not self.instance:
                attrs["quantity_unit"] = "servings"
        elif not current("condition"):
            raise serializers.ValidationError({"condition": "Condition is required for clothes and essentials."})
        return attrs


class PickupRequestSerializer(serializers.ModelSerializer):
    donation_detail = DonationSerializer(source="donation", read_only=True)
    ngo_name = serializers.CharField(source="ngo.name", read_only=True)
    contact = serializers.SerializerMethodField()

    class Meta:
        model = PickupRequest
        fields = (
            "id", "donation", "donation_detail", "ngo", "ngo_name", "status",
            "message", "contact", "created_at", "updated_at",
        )
        read_only_fields = ("id", "ngo", "status", "created_at", "updated_at")

    def get_contact(self, obj):
        """Phone numbers are shared with the other party only once a pickup is accepted."""
        if obj.status not in (PickupRequest.Status.ACCEPTED, PickupRequest.Status.COMPLETED):
            return None
        request = self.context.get("request")
        if not request:
            return None
        if request.user.id == obj.ngo_id:
            other = obj.donation.donor
        elif request.user.id == obj.donation.donor_id:
            other = obj.ngo
        else:
            return None
        return {"name": other.name, "phone": other.phone}

    def validate_donation(self, donation):
        if donation.status != Donation.Status.AVAILABLE or donation.is_expired:
            raise serializers.ValidationError("This donation is no longer available.")
        return donation

    def validate(self, attrs):
        request = self.context["request"]
        if PickupRequest.objects.filter(donation=attrs["donation"], ngo=request.user).exists():
            raise serializers.ValidationError("You have already requested this donation.")
        return attrs


class NGONeedSerializer(serializers.ModelSerializer):
    ngo_name = serializers.CharField(source="ngo.name", read_only=True)
    ngo_city = serializers.CharField(source="ngo.city", read_only=True)

    class Meta:
        model = NGONeed
        fields = (
            "id", "ngo", "ngo_name", "ngo_city", "need_type", "title", "description",
            "quantity_needed", "urgency", "is_active", "created_at",
        )
        read_only_fields = ("id", "ngo", "created_at")
