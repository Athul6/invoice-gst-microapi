# Invoice & Receipt Parser + Indian GSTIN Checksum Validator Micro-API

High-performance, lightweight microservice designed for RapidAPI monetization and SaaS automation workflows (Zapier, Make, n8n, Retool).

---

## 🚀 Key Features

1. **Indian GSTIN Validator with Modulo 36 Checksum**:
   - Validates official 15-character GSTIN structure against state codes and PAN format.
   - Calculates and verifies the official 15th check character using the Luhn Modulo 36 algorithm.
   - Returns state name, state code, PAN, and entity number.

2. **Unstructured Invoice & Receipt Text Parser**:
   - Accepts raw text from OCR (Tesseract, AWS Textract, Google Cloud Vision, or PDF text).
   - Extracts GSTINs, PANs, phone numbers, emails, invoice numbers, and dates.
   - Parses subtotal, CGST, SGST, IGST, and total amounts.
   - Identifies candidate itemized table lines.

3. **Tax Calculation Engine**:
   - Calculates intrastate (CGST + SGST) vs interstate (IGST) breakdowns given an amount and tax rate.

---

## 🛠 Local Setup & Testing

```bash
# 1. Install dependencies
npm install

# 2. Run test suite
npm test

# 3. Start local development server
npm run dev
```

The server starts at `http://localhost:3000`.

---

## 📡 API Endpoints

### 1. Health Check
- **GET** `/health`
- **Response**:
```json
{
  "status": "ok",
  "service": "invoice-gst-microapi",
  "uptime": 12.45,
  "timestamp": "2026-11-22T17:51:00.000Z"
}
```

### 2. Validate GSTIN
- **POST** `/v1/validate-gstin`
- **Request Body**:
```json
{
  "gstin": "29AABCU9603R1ZJ"
}
```
- **Response**:
```json
{
  "gstin": "29AABCU9603R1ZJ",
  "valid": true,
  "formatValid": true,
  "checksumValid": true,
  "expectedChecksum": "J",
  "details": {
    "stateCode": "29",
    "stateName": "Karnataka",
    "pan": "AABCU9603R",
    "entityNumber": "1",
    "isDefaultZ": true
  }
}
```

### 3. Parse Invoice Text
- **POST** `/v1/parse-invoice-text`
- **Request Body**:
```json
{
  "text": "TAX INVOICE\nKochi Tech\nGSTIN: 32AAECK1234A1Z7\nInvoice No: INV-2026-001\nDate: 22/11/2026\nTotal: INR 17,700.00"
}
```

### 4. Calculate Tax
- **POST** `/v1/calculate-tax`
- **Request Body**:
```json
{
  "amount": 10000,
  "rate": 18,
  "isInterState": false
}
```

---

## 🌐 Deploy Tonight (Render / Railway / Fly.io)

### Option A: Render (Free Web Service)
1. Push this folder to a GitHub repository (`invoice-gst-microapi`).
2. Log into [Render.com](https://render.com) and click **New > Web Service**.
3. Select your repository. Render automatically picks up `render.yaml`.
4. Copy your live URL (e.g. `https://invoice-gst-microapi.onrender.com`).

### Option B: Railway
1. Go to [railway.app](https://railway.app) > **New Project** > **Deploy from GitHub repo**.
2. Railway will build using the included `Dockerfile`.

---

## 💰 RapidAPI Listing Guide (10 Minutes)

1. Go to [RapidAPI Studio](https://rapidapi.com/studio).
2. Click **Add New API**:
   - **Name:** Structured Invoice Parser & Indian GSTIN Validator
   - **Category:** Finance / Tools / Machine Learning
3. Under **Target Endpoints**, set `Base URL` to your live Render HTTPS URL.
4. Add the endpoints:
   - `/health` (GET)
   - `/v1/validate-gstin` (POST)
   - `/v1/parse-invoice-text` (POST)
   - `/v1/calculate-tax` (POST)
5. Configure Pricing Plans:
   - **Basic (Free):** 100 requests/month (free tier drives traffic and SEO rankings)
   - **Pro ($19/mo):** 15,000 requests/month ($0.002 overage)
   - **Ultra ($69/mo):** 100,000 requests/month ($0.001 overage)
