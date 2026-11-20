from django.contrib import admin

from .models import Donation, NGONeed, PickupQRToken, PickupRequest


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ("title", "donation_type", "donor", "quantity", "status", "expiry", "created_at")
    list_filter = ("donation_type", "status")
    search_fields = ("title", "location", "donor__email")


@admin.register(PickupRequest)
class PickupRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "donation", "ngo", "status", "created_at")
    list_filter = ("status",)


@admin.register(NGONeed)
class NGONeedAdmin(admin.ModelAdmin):
    list_display = ("title", "need_type", "ngo", "urgency", "is_active")
    list_filter = ("need_type", "urgency", "is_active")


admin.site.register(PickupQRToken)
