
from django.conf import settings
from django.middleware.csrf import get_token, CsrfViewMiddleware
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    EmailTokenSerializer,
    RegisterSerializer,
    UserSerializer,
)


# ==========================================
# CSRF VALIDATION
# ==========================================

def check_csrf(request):
    """
    Explicitly validate CSRF for cookie-based authentication
    on login, refresh and logout endpoints.
    """

    django_request = request._request

    csrf_middleware = CsrfViewMiddleware(
        lambda req: None
    )

    csrf_middleware.process_request(django_request)

    response = csrf_middleware.process_view(
        django_request,
        lambda req: None,
        (),
        {},
    )

    if response is not None:
        raise PermissionDenied(
            "CSRF verification failed. Please refresh and try again."
        )


# ==========================================
# SET AUTHENTICATION COOKIES
# ==========================================

def set_auth_cookies(response, access_token, refresh_token=None):

    access_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]

    response.set_cookie(
        key=settings.JWT_ACCESS_COOKIE,
        value=str(access_token),
        max_age=int(access_lifetime.total_seconds()),
        httponly=settings.JWT_COOKIE_HTTPONLY,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path=settings.JWT_ACCESS_COOKIE_PATH,
    )

    if refresh_token is not None:

        refresh_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]

        response.set_cookie(
            key=settings.JWT_REFRESH_COOKIE,
            value=str(refresh_token),
            max_age=int(refresh_lifetime.total_seconds()),
            httponly=settings.JWT_COOKIE_HTTPONLY,
            secure=settings.JWT_COOKIE_SECURE,
            samesite=settings.JWT_COOKIE_SAMESITE,
            path=settings.JWT_REFRESH_COOKIE_PATH,
        )


# ==========================================
# CLEAR AUTHENTICATION COOKIES
# ==========================================

def clear_auth_cookies(response):

    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE,
        path=settings.JWT_ACCESS_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )

    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )


# ==========================================
# REGISTER
# ==========================================

class RegisterView(generics.CreateAPIView):

    serializer_class = RegisterSerializer

    permission_classes = [
        permissions.AllowAny
    ]

    throttle_scope = "auth"


# ==========================================
# LOGIN
# ==========================================

class LoginView(TokenObtainPairView):

    serializer_class = EmailTokenSerializer

    permission_classes = [
        permissions.AllowAny
    ]

    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):

        # Validate CSRF before login.
        check_csrf(request)

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        access_token = data["access"]
        refresh_token = data["refresh"]

        # Serialize the authenticated user.
        user_data = UserSerializer(
            serializer.user
        ).data

        response = Response(
            {
                "message": "Login successful",
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )

        # Store JWT tokens in HttpOnly cookies.
        set_auth_cookies(
            response,
            access_token,
            refresh_token,
        )

        return response


# ==========================================
# REFRESH ACCESS TOKEN
# ==========================================

class RefreshView(APIView):

    permission_classes = [
        permissions.AllowAny
    ]

    throttle_scope = "auth"

    def post(self, request):

        check_csrf(request)

        refresh_token = request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE
        )

        if not refresh_token:

            response = Response(
                {
                    "detail": "Refresh cookie is missing. Please log in again."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

            clear_auth_cookies(response)

            return response

        serializer = TokenRefreshSerializer(
            data={
                "refresh": refresh_token
            }
        )

        try:

            serializer.is_valid(
                raise_exception=True
            )

        except (TokenError, ValidationError):

            response = Response(
                {
                    "detail": "Refresh token is invalid or expired. Please log in again."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

            clear_auth_cookies(response)

            return response

        data = serializer.validated_data

        access_token = data["access"]

        new_refresh_token = data.get("refresh")

        response = Response(
            {
                "message": "Token refreshed successfully"
            },
            status=status.HTTP_200_OK,
        )

        # Update cookies after successful refresh.
        set_auth_cookies(
            response,
            access_token,
            new_refresh_token,
        )

        return response


# ==========================================
# LOGOUT
# ==========================================

class LogoutView(APIView):

    permission_classes = [
        permissions.AllowAny
    ]

    def post(self, request):

        check_csrf(request)

        refresh_token = request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE
        )

        if refresh_token:

            try:

                token = RefreshToken(
                    refresh_token
                )

                token.blacklist()

            except TokenError:
                pass

        response = Response(
            {
                "message": "Logout successful"
            },
            status=status.HTTP_200_OK,
        )

        # Remove authentication cookies.
        clear_auth_cookies(response)

        return response


# ==========================================
# CURRENT USER DETAILS
# ==========================================

class MeView(generics.RetrieveUpdateAPIView):

    serializer_class = UserSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get_object(self):

        return self.request.user


# ==========================================
# CSRF COOKIE INITIALIZATION
# ==========================================

@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):

    permission_classes = [permissions.AllowAny]

    def get(self, request):

        # Generate the CSRF token.
        csrf_token = get_token(request)

        response = Response({
            "csrfToken": csrf_token,
        })

        # Explicitly set the CSRF cookie in the browser.
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=request.META["CSRF_COOKIE"],
            max_age=settings.CSRF_COOKIE_AGE,
            domain=settings.CSRF_COOKIE_DOMAIN,
            path=settings.CSRF_COOKIE_PATH,
            secure=settings.CSRF_COOKIE_SECURE,
            httponly=settings.CSRF_COOKIE_HTTPONLY,
            samesite=settings.CSRF_COOKIE_SAMESITE,
        )

        return response


