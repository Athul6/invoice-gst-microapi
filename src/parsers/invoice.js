const { validateGSTIN } = require('../validators/gstin');

/**
 * Extracts structured financial and metadata fields from unstructured invoice/receipt text.
 */
function parseInvoiceText(text) {
  if (!text || typeof text !== 'string') {
    return { error: 'Provide raw invoice text string' };
  }

  // 1. GST Numbers & PAN extraction
  const rawGstMatches = text.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/gi) || [];
  const uniqueGst = [...new Set(rawGstMatches.map(g => g.toUpperCase()))];
  const validatedGstins = uniqueGst.map(g => validateGSTIN(g));

  const rawPanMatches = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi) || [];
  const uniquePans = [...new Set(rawPanMatches.map(p => p.toUpperCase()))];

  // 2. Email addresses
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const uniqueEmails = [...new Set(emailMatches.map(e => e.toLowerCase()))];

  // 3. Phone / Mobile numbers (Indian 10-digit or standard landline)
  const phoneMatches = text.match(/(?:(?:\+91[\-\s]?)?[6-9]\d{9}|\b0\d{2,4}[\-\s]?\d{6,8}\b)/g) || [];
  const uniquePhones = [...new Set(phoneMatches.map(p => p.trim()))];

  // 4. Invoice / Bill Number detection
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let invoiceNumber = null;
  const invRegexes = [
    /\b(?:invoice|bill|inv|receipt)\s*(?:number|num|no|#)\s*[:.\-]?\s*([A-Za-z0-9\/\-_]+)/i,
    /^(?:tax\s+)?(?:invoice|bill|receipt)\s*[:#]\s*([A-Za-z0-9\/\-_]+)/i
  ];
  for (const line of lines) {
    for (const regex of invRegexes) {
      const match = line.match(regex);
      if (match && match[1]) {
        invoiceNumber = match[1].trim();
        break;
      }
    }
    if (invoiceNumber) break;
  }

  // 5. Dates
  const dateRegex = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  const dateMatches = text.match(dateRegex) || [];
  const uniqueDates = [...new Set(dateMatches)];

  // 6. Tax specifics (CGST, SGST, IGST)
  const cgstMatch = text.match(/CGST(?:\s*@\s*[\d.]+\s*%)?\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const sgstMatch = text.match(/SGST(?:\s*@\s*[\d.]+\s*%)?\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const igstMatch = text.match(/IGST(?:\s*@\s*[\d.]+\s*%)?\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i);

  const cleanAmount = (val) => val ? parseFloat(val.replace(/,/g, '')) : null;

  // 7. Labeled Total vs Subtotal
  let subtotalAmount = null;
  let totalAmount = null;

  const subtotalRegex = /(?:sub\s*total|taxable\s*value|taxable\s*amount)\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const totalRegex = /^(?:grand\s*total|net\s*(?:amount|total)|total\s*(?:amount\s*payable|payable|amount)?|balance\s*due)\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i;

  for (const line of lines) {
    if (subtotalRegex.test(line)) {
      const match = line.match(subtotalRegex);
      if (match && match[1]) subtotalAmount = cleanAmount(match[1]);
      continue;
    }
    const totalMatch = line.match(totalRegex);
    if (totalMatch && totalMatch[1]) {
      totalAmount = cleanAmount(totalMatch[1]);
    }
  }

  const allAmounts = text.match(/(?:INR|Rs\.?|₹|\$)\s*[\d,]+(?:\.\d{1,2})?/gi) || [];
  const numericAmounts = allAmounts
    .map(a => parseFloat(a.replace(/[^0-9.]/g, '')))
    .filter(n => !isNaN(n) && n > 0);

  // Fallback total selection if no labeled total line found
  const estimatedTotal = totalAmount !== null
    ? totalAmount
    : (numericAmounts.length ? Math.max(...numericAmounts) : null);

  // 8. Line item heuristics (detect rows with item name + price)
  const candidateItems = [];
  const itemRowRegex = /^([A-Za-z0-9\s\-_]{3,40}?)\s+(\d+(?:\.\d+)?)\s+(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{2})?)\s+(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{2})?)$/;

  for (const line of lines) {
    const rowMatch = line.match(itemRowRegex);
    if (rowMatch) {
      candidateItems.push({
        description: rowMatch[1].trim(),
        quantity: parseFloat(rowMatch[2]),
        unitPrice: cleanAmount(rowMatch[3]),
        total: cleanAmount(rowMatch[4])
      });
    }
  }

  return {
    success: true,
    metadata: {
      invoiceNumber,
      dates: uniqueDates,
      primaryDate: uniqueDates[0] || null,
      emails: uniqueEmails,
      phoneNumbers: uniquePhones,
      gstins: validatedGstins,
      pans: uniquePans
    },
    financials: {
      subtotal: subtotalAmount,
      cgst: cgstMatch ? cleanAmount(cgstMatch[1]) : null,
      sgst: sgstMatch ? cleanAmount(sgstMatch[1]) : null,
      igst: igstMatch ? cleanAmount(igstMatch[1]) : null,
      totalAmount: estimatedTotal,
      detectedMonetaryValues: allAmounts
    },
    lineItems: candidateItems
  };
}

module.exports = {
  parseInvoiceText
};
