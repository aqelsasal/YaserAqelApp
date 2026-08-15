/**
 * Tafqeet Utility: Converts numeric amounts to Arabic words
 */

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

export function convertNumberUnder1000(num: number): string {
  let str = '';
  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    str += hundreds[h];
  }

  if (remainder > 0) {
    if (str !== '') str += ' و';
    if (remainder <= 10) {
      str += ones[remainder];
    } else if (remainder < 20) {
      str += teens[remainder - 10];
    } else {
      const u = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (u > 0) {
        str += `${ones[u]} و${tens[t]}`;
      } else {
        str += tens[t];
      }
    }
  }

  return str;
}

export function tafqeet(input: number | string | undefined | null): string {
  if (input === '' || input === null || input === undefined) return '';
  const num = typeof input === 'string' ? parseFloat(input) : input;
  if (isNaN(num) || !isFinite(num)) return '';
  if (num === 0) return 'صفر';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const integerPart = Math.floor(absNum);
  const decimalPart = Math.round((absNum - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return 'صفر';

  const parts: string[] = [];

  const billions = Math.floor(integerPart / 1000000000);
  let rem = integerPart % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  const remainder = rem % 1000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertNumberUnder1000(billions)} مليارات`);
    else parts.push(`${convertNumberUnder1000(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertNumberUnder1000(millions)} ملايين`);
    else parts.push(`${convertNumberUnder1000(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertNumberUnder1000(thousands)} آلاف`);
    else parts.push(`${convertNumberUnder1000(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(convertNumberUnder1000(remainder));
  }

  let result = parts.join(' و');

  if (decimalPart > 0) {
    const decimalWords = convertNumberUnder1000(decimalPart);
    if (result === '') {
      result = `${decimalWords} من المائة`;
    } else {
      result += ` و ${decimalWords} من المائة`;
    }
  }

  return isNegative ? `سالب ${result}` : result;
}

export function getCurrencyLabel(currency?: string): string {
  if (!currency) return '';
  switch (currency.toUpperCase()) {
    case 'YER':
      return 'ريال يمني';
    case 'SAR':
      return 'ريال سعودي';
    case 'USD':
      return 'دولار أمريكي';
    default:
      return currency;
  }
}
