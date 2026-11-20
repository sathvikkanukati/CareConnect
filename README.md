# CareConnect — Food & Essentials Redistribution Platform

A full-stack community redistribution application. Donors can publish surplus food, clothes and essentials; NGOs can browse contributions, request pickups and confirm handovers using one-time QR codes. NGOs can also publish community needs. The backend additionally includes blood donor profiles and request matching APIs.

## Project structure

```text
CareConnect/
├── backend/                 # Django + Django REST Framework API
│   ├── accounts/            # registration, login, user roles
│   ├── donations/           # donations, NGO needs, pickup requests, QR
│   ├── blood/               # blood donor and request APIs
│   ├── config/              # Django settings and URL configuration
│   ├── .env                 # local settings (create from .env.example)
│   └── manage.py
├── frontend/                # React + Vite application
│   ├── src/pages/            # login, register, donor/NGO dashboards, etc.
│   └── .env                  # frontend API URL
└── postman/                  # API collection for testing
```

## Requirements

- Python 3.10+ (Python 3.12 is a safe choice for Django 5.x)
- Node.js 20+ and npm
- MySQL 8+ if using MySQL; SQLite is configured for a quick local first run
- Postman (optional, for API testing)

## 1. Start the backend (Windows PowerShell)

Open PowerShell in the project root:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
# If PowerShell blocks activation, run this once in the current terminal:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

Copy-Item .env.example .env
pip install -r requirements.txt
py manage.py makemigrations accounts donations blood
py manage.py migrate
py manage.py createsuperuser
py manage.py runserver
```

The API runs at `http://127.0.0.1:8000/` and Django admin at `http://127.0.0.1:8000/admin/`.

**Database:** The supplied `.env.example` uses SQLite so you can get the application running without database setup. To use MySQL, create a database first:

```sql
CREATE DATABASE food_redistribution CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then edit `backend/.env`: set `DB_ENGINE=mysql`, `DB_NAME=food_redistribution`, `DB_USER`, `DB_PASSWORD`, `DB_HOST=127.0.0.1`, and `DB_PORT=3306`. Install the MySQL client development components required by `mysqlclient` on your Windows setup before running migrations.

## 2. Start the frontend

Keep the backend terminal running. Open a **second** PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173/`.

The frontend `.env` already points to `http://127.0.0.1:8000/api`. If you change the backend address, update `VITE_API_URL` and restart Vite. Optional donation photo uploads need Cloudinary values in `frontend/.env`; photo upload can be left blank and the app can be used without photos.

## 3. Run tests / check the project

Backend checks (backend terminal):

```powershell
py manage.py check
py manage.py test
```

Frontend production build (frontend terminal):

```powershell
npm run build
npm run preview
```

## 4. Test APIs with Postman

Import `postman/ShareBite-API.postman_collection.json` into Postman. Set the collection variables:

- `baseUrl` = `http://127.0.0.1:8000/api`
- `accessToken` = leave empty initially
- `donationId` / `pickupId` = fill with IDs returned by earlier requests

Suggested end-to-end test order:

1. **Register donor** — `POST /auth/register/` with name, email, password, phone, city and role `donor`.
2. **Login donor** — `POST /auth/login/`. Copy the returned `access` token into `accessToken`.
3. **Create donation** — `POST /donations/` with `donation_type`, `title`, `quantity`, `location`; for food include an `expiry` timestamp in the future.
4. Register and log in a second account with role `ngo`; replace `accessToken` with the NGO access token.
5. **Browse donations** — `GET /donations/?status=available`.
6. **Request pickup** — `POST /pickups/` with `{ "donation": 1, "message": "We can collect this today." }` (replace the ID).
7. Log in as donor again, then accept the request using `POST /pickups/{pickupId}/accept/`.
8. Log in as NGO, generate the QR token using `POST /pickups/{pickupId}/qr/`.
9. Log in as donor, verify handover using `POST /pickups/verify-qr/` with the token returned by the QR endpoint.
10. Test the needs board: NGO `POST /needs/`; donor/NGO `GET /needs/`.

Protected endpoints require this header:

```text
Authorization: Bearer <access token>
```

Register/login response shapes and validation errors are returned by the API. Use the response IDs rather than assuming the example IDs above.

## Main API routes

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register/` | Create donor or NGO account |
| POST | `/auth/login/` | Get JWT access/refresh tokens |
| POST | `/auth/refresh/` | Refresh access token |
| GET/PATCH | `/auth/me/` | Current account profile |
| GET/POST | `/donations/` | List/create donations |
| PATCH | `/donations/{id}/` | Update own available donation |
| POST | `/donations/{id}/cancel/` | Cancel donation |
| GET/POST | `/pickups/` | List/request pickups |
| POST | `/pickups/{id}/accept/` | Donor accepts pickup |
| POST | `/pickups/{id}/reject/` | Donor rejects pickup |
| POST | `/pickups/{id}/qr/` | NGO creates one-time pickup QR token |
| POST | `/pickups/verify-qr/` | Donor verifies token and completes handover |
| GET/POST | `/needs/` | View/post NGO needs |
| GET | `/stats/` | Dashboard counts |
| GET/POST | `/blood/donor-profile/` | Blood donor profile |
| GET/POST | `/blood/requests/` | Blood requests |

## Notes

- Donor and NGO dashboards use role-protected frontend routes.
- QR tokens are short-lived and one-time-use. The donor scans the NGO's QR code to confirm the handover.
- Camera scanning requires localhost or HTTPS and browser camera permission. If camera access is unavailable, use the manual token input.
- The UI uses a responsive custom design with Bootstrap 5 utilities available through the stylesheet CDN. An internet connection is needed for the Bootstrap CDN and hosted fonts; the custom CSS still provides the app's core layout and styling.
- Never commit your real `.env`, passwords, production secret key or API credentials.
