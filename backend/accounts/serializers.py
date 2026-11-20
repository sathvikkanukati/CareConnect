from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Admin accounts can only be created with `createsuperuser`.
    role = serializers.ChoiceField(choices=[User.Role.DONOR, User.Role.NGO], default=User.Role.DONOR)

    class Meta:
        model = User
        fields = ("id", "name", "email", "phone", "city", "role", "password")

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"], User(email=attrs["email"], name=attrs["name"]))
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "name", "email", "phone", "city", "role", "date_joined")
        read_only_fields = ("id", "email", "role", "date_joined")


class EmailTokenSerializer(TokenObtainPairSerializer):
    """Login with email + password; response also includes the user profile."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
