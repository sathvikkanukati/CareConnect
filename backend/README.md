# Food Redistribution: Django backend

REST API for the food redistribution app, rebuilt on **Django + Django REST Framework + MySQL**
(replacing the Firebase backend of the original Next.js project) with new features:

- **Food, clothes and essentials donations**: one `Donation` model with a `type`, reusing the same pickup + QR flow
- **NGO needs board**: NGOs post what they currently need
- **Blood donor connection**: donor profiles, blood requests, compatibility matching, contact shared only after acceptance

## Setup

```bash
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt                       # mysqlclient needs MySQL client libs installed
cp .env.example .env                                  # then edit values

# MySQL: create the database first
#   CREATE DATABASE food_redistribution CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

python manage.py makemigrations accounts donations blood   # migrations are not pre-generated
python manage.py migrate
python manage.py createsuperuser                      # this is how admin accounts are made
python manage.py runserver

AI donation photo suggestions for food, clothes, and essentials are optional. Set `GEMINI_API_KEY` in the backend `.env` to enable them. The key stays on the server; uploaded photos are sent to Gemini for analysis with request storage disabled.
python manage.py test                                 # run the included tests
```

For a quick try without MySQL, set `DB_ENGINE=sqlite` in `.env`.
Cron job suggestion: `python manage.py expire_donations` every 15 minutes.

## API (all under `/api/`, JWT via `Authorization: Bearer <access>`)

| Endpoint | Who | Purpose |
|---|---|---|
| `POST auth/register/` | public | `name, email, password, phone, city, role` (`donor` or `ngo`) |
| `POST auth/login/` | public | email + password, returns `access`, `refresh`, `user` |
| `POST auth/refresh/` | public | new access token |
| `GET/PATCH auth/me/` | any | own profile |
| `GET/POST donations/` | donor: own; NGO: available | filters `donation_type, status, condition`; `search`, `ordering` |
| `PATCH donations/{id}/`, `POST donations/{id}/cancel/` | donor | edit (while available) / cancel |
| `POST pickups/` | NGO | request a donation `{donation: id, message}` |
| `POST pickups/{id}/accept/`, `reject/` | donor | accepting reserves the donation and declines other requests |
| `POST pickups/{id}/qr/` | NGO | one-time token (valid `PICKUP_QR_TTL_MINUTES`), render it as a QR code |
| `POST pickups/verify-qr/` | donor | `{token}`: completes pickup and donation |
| `GET/POST needs/` | all read; NGO write | NGO needs board |
| `GET stats/` | any | role-aware counts for dashboard charts |
| `GET/PUT/PATCH/DELETE blood/donor-profile/` | any | register as blood donor |
| `GET/POST blood/requests/` | any | `?mine=true`, `?for_me=true`, `?blood_group=&city=&urgency=` |
| `POST blood/requests/{id}/respond/` | donor | `{accept: true/false}` |
| `GET blood/requests/{id}/matches/` | requester | compatible, available, eligible donors (no phone numbers) |
| `GET blood/requests/{id}/responses/` | requester | who accepted; phone only for accepted donors |
| `POST blood/requests/{id}/set-status/` | requester | `fulfilled` or `cancelled` |
| `GET blood/my-responses/` | any | requests I accepted or declined |

## Design notes

- **Privacy:** phone numbers are exchanged only after a pickup is accepted / a blood donor accepts.
- **QR tokens:** only a SHA-256 hash is stored; tokens are one-time, short-lived, and verified inside a DB transaction with row locks.
- **Blood matching** is a convenience (standard red-cell compatibility, plus a configurable cooldown between donations).
  The hospital must always confirm compatibility and donor eligibility.
- **Images:** the API stores an `image_url`. Keep uploading to Cloudinary from React, as the original app did.

## Next steps

React frontend (login/register, donate forms per type, NGO and donor dashboards, blood pages),
email/SMS notifications for matching blood requests, and Django Channels if you want live updates.
