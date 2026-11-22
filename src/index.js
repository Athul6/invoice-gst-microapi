const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { validateGSTIN } = require('./validators/gstin');
const { parseInvoiceText } = require('./parsers/invoice');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health Check Endpoint (Required by RapidAPI & Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'invoice-gst-microapi',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// RapidAPI Root Welcome & Discovery
app.get('/', (req, res) => {
  res.json({
    name: 'Structured Invoice Parser & Indian GSTIN Validator API',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Service health check' },
      { method: 'POST', path: '/v1/validate-gstin', description: 'Validate 15-char Indian GSTIN with Modulo 36 checksum' },
      { method: 'POST', path: '/v1/parse-invoice-text', description: 'Extract metadata, dates, amounts, taxes and GSTIN from raw invoice OCR text' },
      { method: 'POST', path: '/v1/calculate-tax', description: 'Compute CGST, SGST, IGST and total bill amount for a given rate' }
    ]
  });
});

/**
 * 1. Indian GSTIN Format & Modulo 36 Checksum Validator
 * Body: { "gstin": "32AABCU9603R1ZV" }
 */
app.post('/v1/validate-gstin', (req, res) => {
  const { gstin } = req.body;
  if (!gstin || typeof gstin !== 'string') {
    return res.status(400).json({
      valid: false,
      error: 'Missing required field "gstin" (string)'
    });
  }

  const result = validateGSTIN(gstin);
  return res.json(result);
});

/**
 * 2. Unstructured Invoice / Receipt OCR Text to Structured JSON
 * Body: { "text": "INVOICE #INV-2026-001\nGSTIN: 32AABCU9603R1ZV\nTotal: INR 12,450.00" }
 */
app.post('/v1/parse-invoice-text', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Missing required field "text" (raw invoice string)'
    });
  }

  const parsed = parseInvoiceText(text);
  return res.json(parsed);
});

/**
 * 3. Tax Calculator Helper
 * Body: { "amount": 1000, "rate": 18, "isInterState": false }
 */
app.post('/v1/calculate-tax', (req, res) => {
  const { amount, rate = 18, isInterState = false } = req.body;

  const numAmount = parseFloat(amount);
  const numRate = parseFloat(rate);

  if (isNaN(numAmount) || numAmount < 0) {
    return res.status(400).json({ error: 'Valid numeric "amount" is required' });
  }
  if (isNaN(numRate) || numRate < 0) {
    return res.status(400).json({ error: 'Valid numeric "rate" percentage is required (e.g. 5, 12, 18, 28)' });
  }

  const totalTax = (numAmount * numRate) / 100;
  const grandTotal = numAmount + totalTax;

  if (isInterState) {
    return res.json({
      baseAmount: numAmount,
      gstRate: numRate,
      isInterState: true,
      cgst: 0,
      sgst: 0,
      igst: parseFloat(totalTax.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2))
    });
  } else {
    const halfTax = totalTax / 2;
    return res.json({
      baseAmount: numAmount,
      gstRate: numRate,
      isInterState: false,
      cgst: parseFloat(halfTax.toFixed(2)),
      sgst: parseFloat(halfTax.toFixed(2)),
      igst: 0,
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2))
    });
  }
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Micro-API] Server running on port ${PORT}`);
  });
}

module.exports = app;
