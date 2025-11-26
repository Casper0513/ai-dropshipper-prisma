# AI DROPSHIPPER

Automated AI-powered dropshipping pipeline that:

- Pulls products from RapidAPI's Real-Time Amazon Data API
- Uses OpenAI to generate high-converting Shopify descriptions
- Automatically creates products in your Shopify store
- Includes a lightweight web dashboard (Shopify-style UI)
- Supports auto-pricing rules and pluggable image enhancement
- Logs **runs and products** into a database via **Prisma** for analytics (SQLite locally, Postgres on Railway)

---

## 🔧 Tech Stack

- Node.js (ESM)
- Express (web dashboard)
- Axios (HTTP)
- OpenAI Node SDK
- Shopify Admin REST API
- RapidAPI (Real-Time Amazon Data)
- Prisma ORM (SQLite locally, Postgres on Railway)

---

## 🧩 Features

- **AI descriptions** for every imported product
- **Auto-pricing rules** (markup %, 0.99 endings, fallback price)
- **Import filters** on min/max price from source
- **Image enhancement hook** (proxy mode)
- **Web dashboard** to:
  - See current config (keywords, pricing, image mode)
  - Trigger imports for one or all keywords
  - See recent run logs from the DB
- **Analytics logging** in DB:
  - Each import run (keyword, markup, status, counts)
  - Each created product (ASIN, prices, Shopify ID, etc.)

---

## 🚀 Getting Started Locally

```bash
git clone <your-repo-url> ai-dropshipper
cd ai-dropshipper
npm install
cp .env.example .env
```

### 1. Database (local)

Use SQLite locally via Prisma:

In `.env`:

```env
DATABASE_URL="file:./dev.db"
```

Then:

```bash
npx prisma migrate dev --name init
```

This will create `dev.db` and apply the schema.

---

### 2. Fill in `.env` with APIs

- `RAPIDAPI_KEY`, `RAPIDAPI_HOST`
- `OPENAI_API_KEY`
- `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `KEYWORDS`, pricing and image options

---

## ▶️ Run Locally

### Web dashboard

```bash
npm run dev
```

Open: `http://localhost:3000/dashboard`

From there you can:

- Trigger imports
- Override markup % per run
- See last runs (from DB)

### CLI import (for cron/testing)

```bash
npm run import
```

This runs the importer for **all KEYWORDS** configured in `.env` and logs results to DB.

---

## 🐳 Deploy to Railway (with Postgres)

1. Push this repo to GitHub.
2. In Railway:
   - **New Project → New Service → From Repo**
   - Select this repo.
   - Railway will build via the included `Dockerfile`.
3. Add a Postgres database plugin in Railway.
4. From the Postgres resource, copy the `DATABASE_URL` value.
5. In your service's **Variables**, set:

   - `DATABASE_URL=<Railway Postgres URL>`
   - All the other env vars from your local `.env`.

6. Deploy.

The `CMD` in the Dockerfile will:

- Run `npx prisma migrate deploy` against the Postgres DB
- Start the web server

The dashboard will be available at:

- `https://your-service.up.railway.app/dashboard`

Healthcheck:

- `https://your-service.up.railway.app/health`

---

## 🧠 Auto-Pricing Rules

Configured through `.env`:

- `MARKUP_PERCENT=35` → adds +35% margin on source price.
- `PRICE_ENDING=0.99` → final price will be floored then +0.99  
  (e.g. 34.27 → 34.99)
- `FALLBACK_PRICE_USD=19.99` → used when source price is missing/bad.

---

## 🖼 Image Enhancement

Modeled via:

- `IMAGE_ENHANCEMENT_MODE=none`  
  Uses source image URL; Shopify CDN still optimizes.
- `IMAGE_ENHANCEMENT_MODE=proxy`  
  Sends URL through `IMAGE_PROXY_URL` as:
  `IMAGE_PROXY_URL?url=<encoded_src>`

You can plug this into any image AI/upscaler/optimizer you like.

---

## 📊 Analytics Schema (Prisma)

We log:

- **Run**: one per import execution
- **ProductLog**: one per created Shopify product

See `prisma/schema.prisma` for full schema.

You can explore data with:

```bash
npx prisma studio
```

---

## 📡 Web Dashboard / Shopify-style UI

- `/dashboard` shows:
  - Current keywords
  - Price filters and markup
  - Image enhancement mode
  - Recent run history, pulled from DB
- Form to:
  - Run all keywords or a single one
  - Optionally override markup % for that run

---

## 🧩 Extending

Ideas:

- Add charts/graphs (e.g. products per keyword over time)
- Add per-keyword pricing rules in DB
- Add filters and search to analytics page
- Turn dashboard into an embedded Shopify app

---
