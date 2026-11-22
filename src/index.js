require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { GoogleGenAI, Type } = require('@google/genai');
const { validateGSTIN } = require('./validators/gstin');
const { parseInvoiceText } = require('./parsers/invoice');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB PDF limit
});

const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const invoiceSchema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING, description: 'Issuing company or merchant name' },
    vendorGstinOrTaxId: { type: Type.STRING, description: 'GSTIN, VAT, or tax ID if present' },
    invoiceNumber: { type: Type.STRING },
    invoiceDate: { type: Type.STRING, description: 'ISO format YYYY-MM-DD if available' },
    currency: { type: Type.STRING, description: '3-letter currency code e.g. INR, USD' },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER },
          amount: { type: Type.NUMBER }
        },
        required: ['description', 'amount']
      }
    },
    subtotal: { type: Type.NUMBER },
    taxAmount: { type: Type.NUMBER },
    totalAmount: { type: Type.NUMBER }
  },
  required: ['vendorName', 'currency', 'lineItems', 'totalAmount']
};

// Health Check Endpoint (Required by RapidAPI & Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'invoice-gst-microapi',
    aiEnabled: Boolean(ai),
    model: 'gemini-2.5-flash',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// RapidAPI Root Welcome & Discovery
app.get('/', (req, res) => {
  res.json({
    name: 'LLM-Powered Structured Invoice Parser & Indian GSTIN Validator API',
    version: '2.0.0',
    model: 'gemini-2.5-flash',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Service health & AI readiness check' },
      { method: 'POST', path: '/v1/extract-invoice', description: 'Multimodal Gemini 2.5 Flash extraction for scanned PDF / image / text into schema-enforced JSON' },
      { method: 'POST', path: '/v1/validate-gstin', description: 'Validate 15-char Indian GSTIN with Modulo 36 checksum & state decoding' },
      { method: 'POST', path: '/v1/parse-invoice-text', description: 'Deterministic fast regex extractor for raw receipt text' },
      { method: 'POST', path: '/v1/calculate-tax', description: 'Compute CGST, SGST, IGST and total bill amount for a given rate' }
    ]
  });
});

/**
 * 1. Multimodal Gemini 2.5 Flash Invoice Extractor
 * Accepts multipart PDF file ('file'), JSON { base64Pdf }, or JSON { text }
 */
app.post('/v1/extract-invoice', upload.single('file'), async (req, res) => {
  try {
    const parts = [
      {
        text: 'Extract all structured invoice and receipt fields accurately. Use 0 for missing numeric amounts and empty string for missing text fields.'
      }
    ];

    if (req.file) {
      parts.push({
        inlineData: {
          mimeType: req.file.mimetype || 'application/pdf',
          data: req.file.buffer.toString('base64')
        }
      });
    } else if (req.body?.base64Pdf) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: req.body.base64Pdf.replace(/^data:application\/pdf;base64,/, '')
        }
      });
    } else if (req.body?.text) {
      parts.push({ text: `Raw Invoice Text:\n${req.body.text}` });
    } else {
      return res.status(400).json({
        error: 'Provide a PDF via multipart "file", JSON "base64Pdf", or raw "text".'
      });
    }

    if (!ai) {
      // Graceful fallback to deterministic parser if GEMINI_API_KEY is not configured yet
      if (req.body?.text) {
        const fallback = parseInvoiceText(req.body.text);
        return res.json({
          success: true,
          notice: 'Parsed using deterministic engine (Set GEMINI_API_KEY for Gemini 2.5 Flash multimodal vision)',
          data: fallback
        });
      }
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on this server. Add GEMINI_API_KEY in environment variables.'
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: invoiceSchema,
        temperature: 0.1
      }
    });

    const extracted = JSON.parse(response.text);

    // If GSTIN was extracted, enrich with checksum and state validation
    if (extracted.vendorGstinOrTaxId) {
      extracted.gstinValidation = validateGSTIN(extracted.vendorGstinOrTaxId);
    }

    return res.json({ success: true, data: extracted });
  } catch (err) {
    console.error('Extraction error:', err);
    return res.status(500).json({ success: false, error: 'Failed to parse document: ' + (err.message || err) });
  }
});

/**
 * 2. Indian GSTIN Format & Modulo 36 Checksum Validator
 * Body: { "gstin": "29AABCU9603R1ZJ" }
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
 * 3. Fast Deterministic Invoice Text Parser (Zero API Key Required)
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
 * 4. Tax Calculator Engine
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
  res.status(500).json({ error: 'Internal server error: ' + err.message });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Micro-API] Server running on port ${PORT}`);
  });
}

module.exports = app;
