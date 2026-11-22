const STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
};

const CHAR_SET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Calculates the 15th checksum character using standard Modulo 36 algorithm.
 */
function computeChecksumChar(first14Chars) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = CHAR_SET.indexOf(first14Chars[i]);
    if (codePoint === -1) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = codePoint * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return CHAR_SET[checkCodePoint];
}

/**
 * Validates a GSTIN string.
 */
function validateGSTIN(rawGstin) {
  if (!rawGstin || typeof rawGstin !== 'string') {
    return {
      valid: false,
      error: 'GSTIN must be a non-empty string'
    };
  }

  const normalized = rawGstin.trim().toUpperCase().replace(/[\s-]/g, '');
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinRegex.test(normalized)) {
    return {
      gstin: normalized,
      valid: false,
      formatValid: false,
      checksumValid: false,
      reason: 'Invalid 15-character GSTIN structure'
    };
  }

  const stateCode = normalized.slice(0, 2);
  const pan = normalized.slice(2, 12);
  const entityNumber = normalized.slice(12, 13);
  const defaultZ = normalized.slice(13, 14);
  const checkChar = normalized.slice(14, 15);

  const stateName = STATE_CODES[stateCode] || 'Unknown State';
  const expectedCheckChar = computeChecksumChar(normalized.slice(0, 14));
  const isChecksumValid = (checkChar === expectedCheckChar);

  return {
    gstin: normalized,
    valid: isChecksumValid,
    formatValid: true,
    checksumValid: isChecksumValid,
    expectedChecksum: expectedCheckChar,
    details: {
      stateCode,
      stateName,
      pan,
      entityNumber,
      isDefaultZ: defaultZ === 'Z'
    }
  };
}

module.exports = {
  STATE_CODES,
  validateGSTIN,
  computeChecksumChar
};
