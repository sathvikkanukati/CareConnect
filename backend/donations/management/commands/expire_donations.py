from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from donations.models import Donation, PickupRequest


class Command(BaseCommand):
    help = "Mark available donations past their expiry as expired and decline their pending requests. Run from cron."

    def handle(self, *args, **options):
        with transaction.atomic():
            expired = Donation.objects.filter(status=Donation.Status.AVAILABLE, expiry__lte=timezone.now())
            ids = list(expired.values_list("id", flat=True))
            PickupRequest.objects.filter(donation_id__in=ids, status=PickupRequest.Status.PENDING).update(
                status=PickupRequest.Status.REJECTED
            )
            count = Donation.objects.filter(id__in=ids).update(status=Donation.Status.EXPIRED)
        self.stdout.write(self.style.SUCCESS(f"Expired {count} donation(s)."))
