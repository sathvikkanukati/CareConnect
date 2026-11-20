from rest_framework.permissions import BasePermission


class IsDonor(BasePermission):
    message = "Only donors can do this."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "donor")


class IsNGO(BasePermission):
    message = "Only NGOs can do this."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "ngo")
