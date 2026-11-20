import base64
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


DONATION_CATEGORIES = {
    "food": ["Cooked meal", "Packaged food", "Fruits & vegetables", "Bakery", "Other"],
    "clothes": ["Men", "Women", "Kids", "Winter wear", "Other"],
    "essentials": ["Blankets", "Toiletries", "Books & stationery", "Utensils", "Other"],
}
DONATION_LABELS = {"food": "food", "clothes": "clothing", "essentials": "essential item"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"


class DonationClassifierError(Exception):
    pass


class ClassifierNotConfigured(DonationClassifierError):
    pass


def _image_mime_type(image_bytes):
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


def classify_donation_image(image_bytes, donation_type):
    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ClassifierNotConfigured
    if donation_type not in DONATION_CATEGORIES:
        raise DonationClassifierError("Choose Food, Clothes, or Essentials first.")
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise DonationClassifierError("Choose an image smaller than 5 MB.")

    mime_type = _image_mime_type(image_bytes)
    if not mime_type:
        raise DonationClassifierError("Use a valid JPEG, PNG, or WebP donation photo.")

    categories = DONATION_CATEGORIES[donation_type]
    item_label = DONATION_LABELS[donation_type]
    schema = {
        "type": "object",
        "properties": {
            "is_item": {"type": "boolean"},
            "item_name": {"type": "string"},
            "category": {"type": "string", "enum": categories},
            "confidence": {"type": "number"},
        },
        "required": ["is_item", "item_name", "category", "confidence"],
    }
    prompt = (
        f"Inspect this image for a ShareBite {item_label} donation. Identify the clearest "
        f"{item_label} in a short plain name and choose exactly one category from the supplied "
        "schema. If no relevant donation item is clearly visible, set is_item to false, "
        "item_name to an empty string, and category to Other. Confidence must be from 0 to 1. "
        "Do not infer condition, size, ingredients, allergens, freshness, expiry, or safety "
        "from appearance. Return only the requested structured result."
    )
    payload = {
        "model": getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "store": False,
        "input": [
            {"type": "text", "text": prompt},
            {
                "type": "image",
                "mime_type": mime_type,
                "data": base64.b64encode(image_bytes).decode("ascii"),
            },
        ],
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": schema,
        },
    }
    request = Request(
        INTERACTIONS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "Api-Revision": "2026-05-20",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise DonationClassifierError("Photo analysis is temporarily unavailable. Please try again.") from exc

    text_parts = []
    for step in result.get("steps", []):
        if step.get("type") != "model_output":
            continue
        text_parts.extend(
            part.get("text", "")
            for part in step.get("content", [])
            if part.get("type") == "text"
        )
    if not text_parts and result.get("output_text"):
        text_parts.append(result["output_text"])
    if not text_parts:
        raise DonationClassifierError("The photo could not be classified. Please enter the details manually.")

    try:
        suggestion = json.loads(text_parts[-1])
        category = suggestion.get("category", "Other")
        item_name = str(suggestion.get("item_name", "")).strip()[:150]
        is_item = bool(suggestion.get("is_item", False))
        confidence = float(suggestion.get("confidence", 0))
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise DonationClassifierError("The photo could not be classified. Please enter the details manually.") from exc

    if category not in categories:
        category = "Other"
    confidence = max(0.0, min(1.0, confidence))
    return {
        "is_item": is_item,
        "item_name": item_name if is_item else "",
        "category": category if is_item else "Other",
        "confidence": round(confidence, 2),
    }
