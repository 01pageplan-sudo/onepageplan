/**
 * Shared validation utilities for emails and phone numbers.
 * Blocks disposable domains, dummy emails, test values, and fake mobile numbers.
 */

const BLOCKED_DOMAINS = new Set([
  "test.com",
  "xyz.com",
  "example.com",
  "example.org",
  "example.net",
  "fake.com",
  "dummy.com",
  "tempmail.com",
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "sharklasers.com",
  "asdf.com",
  "qwerty.com",
  "123.com",
  "abc.com",
  "none.com",
  "nowhere.com",
  "sample.com",
]);

const BLOCKED_LOCAL_PARTS = new Set([
  "test",
  "testing",
  "abc",
  "xyz",
  "admin",
  "dummy",
  "fake",
  "sample",
  "asdf",
  "qwerty",
  "user",
  "nobody",
  "noone",
  "null",
  "undefined",
]);

const INVALID_PHONE_SEQUENCES = new Set([
  "1234567890",
  "0123456789",
  "9876543210",
  "0000000000",
  "1111111111",
  "2222222222",
  "3333333333",
  "4444444444",
  "5555555555",
  "6666666666",
  "7777777777",
  "8888888888",
  "9999999999",
]);

/**
 * Strips formatting, non-digits, leading zeros, and +91 country code prefix.
 * Returns clean 10-digit number or empty string.
 */
export function cleanIndianMobile(raw: string | undefined | null): string {
  if (!raw) return "";
  let val = String(raw).replace(/\D/g, "");
  if (val.startsWith("91") && val.length > 10) {
    val = val.slice(2);
  }
  val = val.replace(/^0+/, "");
  return val.slice(0, 10);
}

/**
 * Validates a 10-digit Indian mobile number.
 * Ensures it starts with 6, 7, 8, or 9 and is not an obvious dummy or sequential number.
 */
export function isValidIndianMobile(raw: string | undefined | null): boolean {
  const clean = cleanIndianMobile(raw);
  if (clean.length !== 10) return false;
  if (!/^[6-9]\d{9}$/.test(clean)) return false;

  // Reject all identical digits (e.g. 9999999999, 8888888888)
  if (/^(\d)\1{9}$/.test(clean)) return false;

  // Reject known sequential fake numbers
  if (INVALID_PHONE_SEQUENCES.has(clean)) return false;

  // Reject numbers with 6 or more consecutive identical digits (e.g. 9999991234)
  if (/(\d)\1{5,}/.test(clean)) return false;

  return true;
}

/**
 * Validates email format and rejects dummy/test domains and names.
 */
export function isValidEmail(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const email = String(raw).trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return false;

  // Standard RFC format regex
  const regex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!regex.test(email)) return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;

  // Domain checks
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (
    domain.endsWith(".test") ||
    domain.endsWith(".example") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".localhost")
  ) {
    return false;
  }

  // Local part checks
  if (BLOCKED_LOCAL_PARTS.has(localPart)) return false;
  if (/^(\d)\1{4,}$/.test(localPart)) return false;

  // Ensure domain has a valid TLD of at least 2 characters
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return false;

  return true;
}
