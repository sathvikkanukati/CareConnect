
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.middleware.csrf import CsrfViewMiddleware


class CookieJWTAuthentication(JWTAuthentication):

    def authenticate(self, request):
        # Support Bearer authentication for Postman and other API clients.
        header = self.get_header(request)

        if header is not None:
            return super().authenticate(request)

        # Browser authentication uses the HttpOnly cookie.
        raw_token = request.COOKIES.get("sharebite_access")

        if not raw_token:
            return None

        validated_token = self.get_validated_token(
            raw_token.encode("utf-8")
        )

        # Require CSRF validation for cookie-authenticated write requests.
        if request.method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
            csrf_check = CsrfViewMiddleware(lambda req: None)
            csrf_check.process_request(request)

            reason = csrf_check.process_view(
                request,
                None,
                (),
                {},
            )

            if reason:
                raise PermissionDenied(
                    "CSRF verification failed. Please refresh the page and try again."
                )

        return self.get_user(validated_token), validated_token
