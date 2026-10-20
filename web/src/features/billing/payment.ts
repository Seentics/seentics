/**
 * The payment details a customer types after paying an invoice in taka, checked before they are
 * sent: the gateway checks them again.
 */

/** A Bangladeshi mobile number as typed, with spaces, dashes and a +880 / 880 prefix taken off. */
export const normalisePayerNumber = (raw: string) => raw.replace(/[\s-]/g, '').replace(/^(\+?880)/, '0');

/** 01, an operator digit 3–9, eight more: 017XXXXXXXX. */
export const isBdMobile = (raw: string) => /^01[3-9]\d{8}$/.test(normalisePayerNumber(raw));

/** bKash and Rocket transaction ids are 10 letters and digits, Nagad's 8; a little either side is allowed. */
export const isTransactionId = (raw: string) => /^[A-Za-z0-9]{6,20}$/.test(raw.trim());
