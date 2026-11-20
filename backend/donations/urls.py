from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DonationViewSet, FoodImageClassificationView, NGONeedViewSet, PickupRequestViewSet, StatsView

router = DefaultRouter()
router.register("donations", DonationViewSet, basename="donation")
router.register("pickups", PickupRequestViewSet, basename="pickup")
router.register("needs", NGONeedViewSet, basename="need")

urlpatterns = [
    path("stats/", StatsView.as_view(), name="stats"),
    path("donations/classify-image/", FoodImageClassificationView.as_view(), name="classify-food-image"),
    path("", include(router.urls)),
]
