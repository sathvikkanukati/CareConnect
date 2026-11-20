
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from django_filters.rest_framework import DjangoFilterBackend

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsDonor, IsNGO

from .donation_classifier import (
    MAX_IMAGE_BYTES,
    ClassifierNotConfigured,
    DonationClassifierError,
    classify_donation_image,
)
from .models import Donation, NGONeed, PickupQRToken, PickupRequest
from .serializers import (
    DonationSerializer,
    NGONeedSerializer,
    PickupRequestSerializer,
)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class DonationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Donors see their own donations.
    NGOs see available (non-expired) donations plus
    any donation they have requested.
    Admins see everything.
    """

    serializer_class = DonationSerializer

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    filterset_fields = [
        "donation_type",
        "status",
        "condition",
        "category",
    ]

    search_fields = [
        "title",
        "description",
        "location",
        "category",
    ]

    ordering_fields = [
        "created_at",
        "expiry",
        "quantity",
    ]

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "cancel",
            "history",
        ):
            return [IsDonor()]

        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        qs = Donation.objects.select_related("donor")

        if user.role == "donor":
            return qs.filter(donor=user)

        if user.role == "ngo":
            now = timezone.now()

            open_now = (
                Q(status=Donation.Status.AVAILABLE)
                & (Q(expiry__isnull=True) | Q(expiry__gt=now))
            )

            return qs.filter(
                open_now | Q(pickup_requests__ngo=user)
            ).distinct()

        return qs

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)

    # --------------------------------------------------
    # DONOR DONATION HISTORY
    # GET /api/donations/history/
    # --------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="history",
    )
    def history(self, request):
        donations = Donation.objects.filter(
            donor=request.user
        ).order_by("-created_at")

        serializer = self.get_serializer(
            donations,
            many=True,
        )

        return Response(serializer.data)

    def perform_update(self, serializer):
        if serializer.instance.status != Donation.Status.AVAILABLE:
            raise ValidationError(
                "Only available donations can be edited."
            )

        serializer.save()

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            donation = Donation.objects.select_for_update().get(
                pk=self.get_object().pk
            )

            if donation.status not in (
                Donation.Status.AVAILABLE,
                Donation.Status.RESERVED,
            ):
                raise ValidationError(
                    "This donation can no longer be cancelled."
                )

            donation.status = Donation.Status.CANCELLED

            donation.save(
                update_fields=["status", "updated_at"]
            )

            donation.pickup_requests.filter(
                status__in=[
                    PickupRequest.Status.PENDING,
                    PickupRequest.Status.ACCEPTED,
                ]
            ).update(
                status=PickupRequest.Status.REJECTED
            )

        return Response(self.get_serializer(donation).data)


class PickupRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PickupRequestSerializer

    filter_backends = [
        DjangoFilterBackend,
        OrderingFilter,
    ]

    filterset_fields = [
        "status",
        "donation",
    ]

    ordering_fields = ["created_at"]

    def get_permissions(self):
        if self.action in ("create", "qr"):
            return [IsNGO()]

        if self.action in (
            "accept",
            "reject",
            "verify_qr",
        ):
            return [IsDonor()]

        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        qs = PickupRequest.objects.select_related(
            "donation",
            "donation__donor",
            "ngo",
        )

        if user.role == "donor":
            return qs.filter(donation__donor=user)

        if user.role == "ngo":
            return qs.filter(ngo=user)

        return qs

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user)

    # --------------------------------------------------
    # DONOR DECISIONS
    # --------------------------------------------------

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        with transaction.atomic():
            pickup = PickupRequest.objects.select_for_update().get(
                pk=self.get_object().pk
            )

            donation = Donation.objects.select_for_update().get(
                pk=pickup.donation_id
            )

            if pickup.status != PickupRequest.Status.PENDING:
                raise ValidationError(
                    "Only pending requests can be accepted."
                )

            if (
                donation.status != Donation.Status.AVAILABLE
                or donation.is_expired
            ):
                raise ValidationError(
                    "This donation is no longer available."
                )

            pickup.status = PickupRequest.Status.ACCEPTED

            pickup.save(
                update_fields=["status", "updated_at"]
            )

            donation.status = Donation.Status.RESERVED

            donation.save(
                update_fields=["status", "updated_at"]
            )

            # Automatically reject other pending requests.
            donation.pickup_requests.filter(
                status=PickupRequest.Status.PENDING
            ).exclude(
                pk=pickup.pk
            ).update(
                status=PickupRequest.Status.REJECTED
            )

        return Response(self.get_serializer(pickup).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        pickup = self.get_object()

        if pickup.status != PickupRequest.Status.PENDING:
            raise ValidationError(
                "Only pending requests can be rejected."
            )

        pickup.status = PickupRequest.Status.REJECTED

        pickup.save(
            update_fields=["status", "updated_at"]
        )

        return Response(self.get_serializer(pickup).data)

    # --------------------------------------------------
    # QR HANDOVER
    # --------------------------------------------------

    @action(detail=True, methods=["post"])
    def qr(self, request, pk=None):
        """
        NGO generates a short-lived one-time token
        to show as a QR code at pickup.
        """

        pickup = self.get_object()

        if pickup.status != PickupRequest.Status.ACCEPTED:
            raise ValidationError(
                "Only accepted pickup requests can generate a QR code."
            )

        token = secrets.token_hex(32)

        expires_at = timezone.now() + timedelta(
            minutes=settings.PICKUP_QR_TTL_MINUTES
        )

        PickupQRToken.objects.update_or_create(
            pickup=pickup,
            defaults={
                "token_hash": _hash(token),
                "expires_at": expires_at,
                "used": False,
            },
        )

        return Response({
            "pickup": pickup.pk,
            "token": token,
            "expires_at": expires_at,
        })

    @action(
        detail=False,
        methods=["post"],
        url_path="verify-qr",
    )
    def verify_qr(self, request):
        """
        Donor scans the NGO's QR code.
        On success the pickup and donation are completed.
        """

        token = request.data.get("token")

        if not isinstance(token, str) or not token.strip():
            raise ValidationError({
                "token": "Token is required."
            })

        with transaction.atomic():
            try:
                qr = (
                    PickupQRToken.objects
                    .select_for_update()
                    .select_related(
                        "pickup",
                        "pickup__donation",
                    )
                    .get(
                        token_hash=_hash(token.strip())
                    )
                )

            except PickupQRToken.DoesNotExist:
                raise ValidationError("Invalid QR code.")

            pickup = qr.pickup
            donation = pickup.donation

            if donation.donor_id != request.user.id:
                raise ValidationError("Invalid QR code.")

            if qr.used:
                raise ValidationError(
                    "This QR code has already been used."
                )

            if qr.expires_at <= timezone.now():
                raise ValidationError(
                    "This QR code has expired. Ask the NGO to generate a new one."
                )

            if pickup.status != PickupRequest.Status.ACCEPTED:
                raise ValidationError(
                    "This pickup is not in an accepted state."
                )

            qr.used = True
            qr.save(update_fields=["used"])

            pickup.status = PickupRequest.Status.COMPLETED

            pickup.save(
                update_fields=["status", "updated_at"]
            )

            donation.status = Donation.Status.COMPLETED

            donation.save(
                update_fields=["status", "updated_at"]
            )

        return Response(
            self.get_serializer(pickup).data,
            status=status.HTTP_200_OK,
        )


class NGONeedViewSet(viewsets.ModelViewSet):
    serializer_class = NGONeedSerializer

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    filterset_fields = [
        "need_type",
        "urgency",
        "ngo",
    ]

    search_fields = [
        "title",
        "description",
    ]

    ordering_fields = [
        "created_at",
        "urgency",
    ]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]

        return [IsNGO()]

    def get_queryset(self):
        qs = NGONeed.objects.select_related("ngo")
        user = self.request.user

        if self.action in ("list", "retrieve"):
            visible = Q(is_active=True)

            if user.role == "ngo":
                visible |= Q(ngo=user)

            return qs.filter(visible)

        # Writes: own needs only.
        return qs.filter(ngo=user)

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user)


class StatsView(APIView):
    """Small role-aware summary for dashboard cards and charts."""

    def get(self, request):
        user = request.user

        by_type = lambda qs: {
            row["donation_type"]: row["n"]
            for row in qs.values("donation_type").annotate(
                n=Count("id")
            )
        }

        by_status = lambda qs: {
            row["status"]: row["n"]
            for row in qs.values("status").annotate(
                n=Count("id")
            )
        }

        if user.role == "donor":
            donations = Donation.objects.filter(donor=user)

            data = {
                "donations_by_type": by_type(donations),
                "donations_by_status": by_status(donations),
            }

        elif user.role == "ngo":
            pickups = PickupRequest.objects.filter(ngo=user)

            data = {
                "pickups_by_status": by_status(pickups),
                "completed_by_type": by_type(
                    Donation.objects.filter(
                        pickup_requests__ngo=user,
                        status="completed",
                    )
                ),
                "active_needs": NGONeed.objects.filter(
                    ngo=user,
                    is_active=True,
                ).count(),
            }

        else:
            data = {
                "donations_by_type": by_type(
                    Donation.objects.all()
                ),
                "donations_by_status": by_status(
                    Donation.objects.all()
                ),
                "pickups_by_status": by_status(
                    PickupRequest.objects.all()
                ),
            }

        return Response(data)


class FoodImageClassificationView(APIView):
    """Return donor-facing food name/category suggestions from an uploaded photo."""

    permission_classes = [IsDonor]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get("image")
        if image is None:
            return Response({"detail": "Choose a food photo first."}, status=status.HTTP_400_BAD_REQUEST)
        if image.size > MAX_IMAGE_BYTES:
            return Response({"detail": "Choose an image smaller than 5 MB."}, status=status.HTTP_400_BAD_REQUEST)
        donation_type = request.data.get("donation_type")
        if donation_type not in ("food", "clothes", "essentials"):
            return Response({"detail": "Choose Food, Clothes, or Essentials first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = classify_donation_image(image.read(), donation_type)
        except ClassifierNotConfigured:
            return Response(
                {"detail": "AI photo suggestions are not configured yet. Add GEMINI_API_KEY to the backend environment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DonationClassifierError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result, status=status.HTTP_200_OK)
