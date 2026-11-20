# Food Redistribution: React frontend (stage 1)

Vite + React (plain JavaScript) app for the Django backend.

## Run

1. Keep the backend running (`python manage.py runserver`, XAMPP MySQL started).
2. In a NEW terminal, inside this folder:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:5173 (use `localhost`, not `127.0.0.1`: the backend's CORS list allows localhost).

Optional photo upload: put your Cloudinary cloud name and unsigned upload preset in `.env`
(`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`), then restart `npm run dev`.

## What's in stage 1

- Register / login (donor or NGO), automatic token refresh
- Donor: dashboard, donate food / clothes / essentials, accept or reject pickup requests, scan the NGO's QR to complete a handover (camera or paste code)
- NGO: browse and search available donations, request pickup, show a one-time pickup QR code
- NGO needs board (NGOs post needs, donors click "Donate this" to prefill the form)


## Try the full flow

Use two browser windows (one normal, one incognito): register a donor and an NGO, donate as the donor,
request as the NGO, accept as the donor, show the QR as the NGO, scan or paste it as the donor.

## If `npm install` fails or the app won't start

Package versions are set to "latest". If something is incompatible, create a fresh Vite project and copy `src/` and `.env` into it:
```
npm create vite@latest fresh -- --template react
cd fresh
npm install
npm install react-router-dom qrcode.react html5-qrcode
```
Then replace its `src` folder with this one's, copy `.env`, and run `npm run dev`.
