const assert = require('assert');
const { validateGSTIN, computeChecksumChar } = require('../src/validators/gstin');
const { parseInvoiceText } = require('../src/parsers/invoice');

console.log('🧪 Starting test suite for invoice-gst-microapi...\n');

// 1. Test GSTIN Checksum calculation
console.log('--- Testing GSTIN Checksum Calculation ---');
const sampleGstin14 = '29AABCU9603R1Z';
const expectedChar = computeChecksumChar(sampleGstin14);
console.log(`Calculated Checksum char for ${sampleGstin14} is: ${expectedChar}`);
assert.strictEqual(typeof expectedChar, 'string', 'Expected string checksum char');

// Test valid 15-char GSTIN
const validGstin = `${sampleGstin14}${expectedChar}`;
const validResult = validateGSTIN(validGstin);
assert.strictEqual(validResult.valid, true, 'GSTIN should be recognized as valid');
assert.strictEqual(validResult.formatValid, true);
assert.strictEqual(validResult.checksumValid, true);
assert.strictEqual(validResult.details.stateName, 'Karnataka');
console.log('✅ Valid GSTIN verified successfully.');

// Test invalid checksum
const invalidCheckGstin = `${sampleGstin14}9`; // tamper checksum
const invalidResult = validateGSTIN(invalidCheckGstin);
assert.strictEqual(invalidResult.formatValid, true, 'Format is valid regex');
assert.strictEqual(invalidResult.checksumValid, false, 'Checksum should fail');
assert.strictEqual(invalidResult.valid, false, 'Overall validation should fail');
console.log('✅ Tampered checksum successfully caught.');

// Test malformed string
const malformed = validateGSTIN('INVALID123');
assert.strictEqual(malformed.valid, false);
console.log('✅ Malformed GSTIN correctly rejected.');

// 2. Test Invoice Text Parsing
console.log('\n--- Testing Invoice Parser ---');
const sampleInvoiceText = `
TAX INVOICE
Kochi Tech Solutions Pvt Ltd
MG Road, Ernakulam, Kerala - 682016
Email: billing@kochitech.com | Phone: +91 9846012345
GSTIN: 32AAECK1234A1Z7
PAN: AAECK1234A

Invoice Number: INV-2026-9041
Invoice Date: 22/11/2026
Due Date: 30/11/2026

Description             Qty    Rate       Total
Cloud Hosting Setup       1   Rs 10,000   Rs 10,000.00
Maintenance Retainer      1   Rs  5,000   Rs  5,000.00

Sub Total: INR 15,000.00
CGST @ 9%: INR 1,350.00
SGST @ 9%: INR 1,350.00
Total Amount Payable: INR 17,700.00
`;

const parsed = parseInvoiceText(sampleInvoiceText);
assert.strictEqual(parsed.success, true);
assert.strictEqual(parsed.metadata.invoiceNumber, 'INV-2026-9041');
assert.ok(parsed.metadata.dates.includes('22/11/2026'));
assert.ok(parsed.metadata.emails.includes('billing@kochitech.com'));
assert.strictEqual(parsed.metadata.pans[0], 'AAECK1234A');
assert.strictEqual(parsed.financials.subtotal, 15000);
assert.strictEqual(parsed.financials.cgst, 1350);
assert.strictEqual(parsed.financials.sgst, 1350);
assert.strictEqual(parsed.financials.totalAmount, 17700);
console.log('✅ Invoice parsed metadata & financials successfully:');
console.log('   - Invoice No:', parsed.metadata.invoiceNumber);
assert.ok(parsed.metadata.phoneNumbers.length > 0, 'Phone number detected');
console.log('   - Phone:', parsed.metadata.phoneNumbers[0]);
console.log('   - Total Amount:', parsed.financials.totalAmount);

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
