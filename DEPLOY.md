# Deploying Aurevia

Database on **MongoDB Atlas**, API on **Render**, storefront and admin on **Vercel**. All three have free tiers.

## 1. Database: MongoDB Atlas

1. Create a free **M0** cluster at https://cloud.mongodb.com.
2. **Database Access** → add a user with a strong password.
3. **Network Access** → allow `0.0.0.0/0` (Render's free tier has no fixed IP).
4. **Connect → Drivers** → copy the `mongodb+srv://...` connection string and put the password in it.

## 2. API: Render

1. https://dashboard.render.com → **New → Blueprint** → choose the `Aurevia` repo. Render reads `render.yaml`.
2. Fill in the secret values when prompted:
   - `MONGO_URL`: the Atlas string from step 1
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`: your admin login (use a strong password)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: see step 4 (leave empty for cash on delivery only)
3. Deploy, then open `https://aurevia-api.onrender.com/api/` and check it returns `{"message":"Aurevia API"}`.

> If Render gives the service a different URL, replace `https://aurevia-api.onrender.com` in `frontend/vercel.json` and `admin/vercel.json`.

The free tier sleeps after 15 minutes idle, so the first request then takes about 30–50 seconds. Uploaded images are stored on the server's disk, which **is wiped on each deploy/restart on the free tier**. Use image URLs, or upgrade to a paid instance with a persistent disk.

## 3. Storefront and admin: Vercel

Create **two** projects from the same repo at https://vercel.com/new:

| Project | Root Directory | Framework | Environment variables |
|---|---|---|---|
| Storefront | `frontend` | Create React App | none |
| Admin | `admin` | Vite | `VITE_STORE_URL` = your storefront URL (e.g. `https://aurevia.vercel.app`) |

`vercel.json` in each folder forwards `/api` and `/uploads` to Render, so logins work without cross-site cookie problems.

## 4. Payments: Razorpay

1. Sign up at https://razorpay.com and stay in **Test mode** first.
2. **Settings → API Keys → Generate key**, then put the Key ID and Secret into Render.
3. **Settings → Webhooks → Add**:
   - URL: `https://<your-storefront-domain>/api/payments/razorpay/webhook`
   - Events: `payment.captured`, `order.paid`
   - Secret: any strong string; put the same value in `RAZORPAY_WEBHOOK_SECRET` on Render.
4. Test a purchase with Razorpay's [test cards/UPI](https://razorpay.com/docs/payments/payments/test-card-upi-details/).
5. Once KYC is approved, switch to **Live mode**, generate live keys and update Render.

## 5. After going live

- Sign in to the admin panel and replace demo slides, categories, offers and products.
- Add your own domain in Vercel (e.g. `aurevia.in` for the store, `admin.aurevia.in` for the admin).
