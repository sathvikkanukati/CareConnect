from django.conf import settings
from django.db import models
from django.utils import timezone


class DonationType(models.TextChoices):
    FOOD = "food", "Food"
    CLOTHES = "clothes", "Clothes"
    ESSENTIALS = "essentials", "Essentials"


class Donation(models.Model):
    """One model for food, clothes and essentials, so pickup + QR work for all three."""

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        RESERVED = "reserved", "Reserved"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    class Condition(models.TextChoices):
        NEW = "new", "New"
        GOOD = "good", "Good"
        USED = "used", "Used"

    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donations")
    donation_type = models.CharField(max_length=12, choices=DonationType.choices, default=DonationType.FOOD)
    title = models.CharField(max_length=150)  # e.g. "Veg biryani", "Winter jackets", "Blankets"
    category = models.CharField(max_length=60, blank=True)  # e.g. "cooked meal", "kids wear", "toiletries"
    description = models.TextField(blank=True)
    quantity = models.PositiveIntegerField()
    quantity_unit = models.CharField(max_length=20, default="items")  # "servings" for food
    condition = models.CharField(max_length=10, choices=Condition.choices, blank=True)  # clothes/essentials
    size_or_age_group = models.CharField(max_length=60, blank=True)  # clothes: "M", "Kids 5-8"
    location = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    expiry = models.DateTimeField(null=True, blank=True)  # required for food
    image_url = models.URLField(max_length=500, blank=True)  # e.g. Cloudinary URL
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "donation_type"]),
            models.Index(fields=["expiry"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.donation_type}, {self.status})"

    @property
    def is_expired(self):
        return self.expiry is not None and self.expiry <= timezone.now()


class PickupRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        COMPLETED = "completed", "Completed"

    donation = models.ForeignKey(Donation, on_delete=models.CASCADE, related_name="pickup_requests")
    ngo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pickup_requests")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    message = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["donation", "ngo"], name="one_request_per_ngo_per_donation"),
        ]

    def __str__(self):
        return f"Pickup #{self.pk} for donation {self.donation_id} by NGO {self.ngo_id} ({self.status})"


class PickupQRToken(models.Model):
    """Only a SHA-256 hash of the token is stored; the raw token lives only in the NGO's QR code."""

    pickup = models.OneToOneField(PickupRequest, on_delete=models.CASCADE, related_name="qr_token")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class NGONeed(models.Model):
    """What an NGO currently needs, so donors can give what is actually wanted."""

    class Urgency(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    ngo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="needs")
    need_type = models.CharField(max_length=12, choices=DonationType.choices)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    quantity_needed = models.PositiveIntegerField(null=True, blank=True)
    urgency = models.CharField(max_length=8, choices=Urgency.choices, default=Urgency.MEDIUM)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.need_type}) - NGO {self.ngo_id}"
