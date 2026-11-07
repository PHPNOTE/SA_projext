import React from 'react';

// Regex helpers for Thai + English letters vs digits
const HAS_LETTER_RE = /[a-zA-Z\u0E01-\u0E2E\u0E40-\u0E44]/;
const HAS_DIGIT_RE = /[0-9\u0E50-\u0E59]/;
const HAS_ASCII_DIGIT_RE = /[0-9]/;

/**
 * Block scientific/sign keys ('e', 'E', '+', '-', '.') on integer <input type="number">
 */
export function blockInvalidIntKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Block scientific/sign keys ('e', 'E', '+', '-') on decimal <input type="number">
 */
export function blockInvalidDecimalKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Live sanitizer for person names (Customer, Staff):
 * Strictly strips all ASCII & Thai digits (0-9, ๐-๙) and invalid symbols.
 */
export function sanitizePersonName(val: string, maxLen = 100): string {
  return val
    .replace(/[0-9\u0E50-\u0E59]/g, '')
    .replace(/[^a-zA-Z\u0E01-\u0E4F\u0E5A-\u0E7F\s.\-()/]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Live sanitizer for organization / company / insurer / supplier names:
 * Strictly strips all ASCII & Thai digits (0-9, ๐-๙) while allowing '&' and ','.
 */
export function sanitizeOrgName(val: string, maxLen = 120): string {
  return val
    .replace(/[0-9\u0E50-\u0E59]/g, '')
    .replace(/[^a-zA-Z\u0E01-\u0E4F\u0E5A-\u0E7F\s.\-()&,\/]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Live sanitizer for phone numbers:
 * Strictly strips all letters (Thai/English), spaces, and symbols except digits (0-9) and '-'.
 * Caps total digits to 10 (standard Thai 9-10 digit phone numbers).
 */
export function sanitizePhone(val: string): string {
  // Convert Thai digits if accidentally typed on Thai keyboard layout? No, user explicitly wants non-digits blocked: strip non [0-9-]
  const cleaned = val.replace(/[^0-9-]/g, '').replace(/-{2,}/g, '-');
  let digitCount = 0;
  let result = '';
  for (const ch of cleaned) {
    if (ch >= '0' && ch <= '9') {
      if (digitCount >= 10) continue;
      digitCount++;
      result += ch;
    } else if (ch === '-') {
      if (result.length < 12) {
        result += ch;
      }
    }
  }
  return result.slice(0, 13);
}

/**
 * Live sanitizer for Thai/standard vehicle license plates:
 * Allows Thai letters, English letters, Arabic digits, spaces, '-', '.'
 */
export function sanitizeLicensePlate(val: string, maxLen = 35): string {
  return val
    .replace(/[\u0E50-\u0E59]/g, '')
    .replace(/[^a-zA-Z0-9\u0E01-\u0E4F\s\-.]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Live sanitizer for vehicle model names (e.g. Corolla Altis 1.8G, CX-5)
 */
export function sanitizeVehicleModel(val: string, maxLen = 50): string {
  return val
    .replace(/[\u0E50-\u0E59]/g, '')
    .replace(/[^a-zA-Z0-9\u0E01-\u0E4F\s\-./()]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Live sanitizer for usernames: English letters, digits, '_', '.' only, no spaces or Thai chars
 */
export function sanitizeUsername(val: string, maxLen = 30): string {
  return val.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, maxLen);
}

/**
 * Live sanitizer for uppercase codes (SKU, Shelf Location, Insurance Claim No.)
 */
export function sanitizeCodeUpper(val: string, maxLen = 30): string {
  return val
    .toUpperCase()
    .replace(/[^A-Z0-9\-_/]/g, '')
    .slice(0, maxLen);
}

/**
 * Live sanitizer for Bay Name / General Text (trims leading whitespace and control chars)
 */
export function sanitizeGeneralText(val: string, maxLen = 300): string {
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/^\s+/, '')
    .slice(0, maxLen);
}

/**
 * Validate person name (no digits, must have letters, min length >= 2)
 */
export function validatePersonName(val: string, label = 'ชื่อ-นามสกุล'): string | null {
  const trimmed = val.trim();
  if (!trimmed) {
    return `กรุณากรอก${label}`;
  }
  if (HAS_DIGIT_RE.test(trimmed)) {
    return `${label}ห้ามมีตัวเลข`;
  }
  if (!HAS_LETTER_RE.test(trimmed) || trimmed.length < 2) {
    return `กรุณากรอก${label}ให้ถูกต้อง (อย่างน้อย 2 ตัวอักษร)`;
  }
  return null;
}

/**
 * Validate organization / insurer / supplier name (no digits, must have letters)
 */
export function validateOrgName(val: string, label = 'ชื่อบริษัท/หน่วยงาน'): string | null {
  const trimmed = val.trim();
  if (!trimmed) {
    return `กรุณากรอก${label}`;
  }
  if (HAS_DIGIT_RE.test(trimmed)) {
    return `${label}ห้ามมีตัวเลข`;
  }
  if (!HAS_LETTER_RE.test(trimmed) || trimmed.length < 2) {
    return `กรุณากรอก${label}ให้ถูกต้อง (อย่างน้อย 2 ตัวอักษร)`;
  }
  return null;
}

/**
 * Validate Thai phone number (9-10 digits starting with 0; allows '-' separator; optional Walk-in '-')
 */
export function validatePhone(
  val: string,
  opts?: { allowWalkInDash?: boolean; label?: string }
): string | null {
  const label = opts?.label || 'เบอร์โทรศัพท์';
  const trimmed = val.trim();
  if (opts?.allowWalkInDash && (trimmed === '' || trimmed === '-')) {
    return null;
  }
  if (!trimmed) {
    return `กรุณากรอก${label}`;
  }
  if (!/^[0-9-]+$/.test(trimmed)) {
    return `${label}ต้องประกอบด้วยตัวเลข 0-9 เท่านั้น (ห้ามใส่ตัวอักษร)`;
  }
  const digitsOnly = trimmed.replace(/-/g, '');
  if (!/^0\d{8,9}$/.test(digitsOnly)) {
    return `${label}ไม่ถูกต้อง ต้องขึ้นต้นด้วยเลข 0 และมีความยาว 9-10 หลัก (เช่น 089-123-4567)`;
  }
  return null;
}

/**
 * Validate vehicle license plate (must contain both letters and digits)
 */
export function validateLicensePlate(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) {
    return 'กรุณากรอกเลขทะเบียนรถ';
  }
  if (trimmed.length < 4 || trimmed.length > 35) {
    return 'เลขทะเบียนรถต้องมีความยาว 4-35 ตัวอักษร';
  }
  if (!HAS_LETTER_RE.test(trimmed) || !HAS_ASCII_DIGIT_RE.test(trimmed)) {
    return 'เลขทะเบียนรถต้องมีทั้งหมวดตัวอักษรและตัวเลข (เช่น 1กข-8888 กทม.)';
  }
  return null;
}

/**
 * Validate text that must contain at least one letter (prevents numbers-only or punctuation-only garbage)
 */
export function validateMeaningfulText(
  val: string,
  label: string,
  minLen = 2
): string | null {
  const trimmed = val.trim();
  if (!trimmed) {
    return `กรุณากรอก${label}`;
  }
  if (trimmed.length < minLen) {
    return `${label}ต้องมีความยาวอย่างน้อย ${minLen} ตัวอักษร`;
  }
  if (!HAS_LETTER_RE.test(trimmed)) {
    return `${label}ต้องมีตัวอักษรภาษาไทยหรือภาษาอังกฤษ (ห้ามกรอกเฉพาะตัวเลขหรือสัญลักษณ์)`;
  }
  return null;
}

/**
 * Validate staff username (starts with English letter, 3-30 chars, [a-zA-Z0-9_.])
 */
export function validateUsername(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) {
    return 'กรุณากรอกชื่อผู้ใช้งาน (Username)';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_.]{2,29}$/.test(trimmed)) {
    return 'Username ต้องขึ้นต้นด้วยตัวอักษรภาษาอังกฤษ (a-z) ความยาว 3-30 ตัวอักษร และใช้ได้เฉพาะ a-z, 0-9, _ หรือ .';
  }
  return null;
}

/**
 * Validate Part SKU code
 */
export function validateSku(val: string): string | null {
  const trimmed = val.trim().toUpperCase();
  if (!trimmed) {
    return 'กรุณากรอกรหัสอะไหล่ (SKU Code)';
  }
  if (!/^[A-Z0-9][A-Z0-9\-_]{2,29}$/.test(trimmed) || !/[A-Z]/.test(trimmed)) {
    return 'รหัสอะไหล่ (SKU) ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ (A-Z) ความยาว 3-30 ตัว (เช่น BRK-PAD-01)';
  }
  return null;
}

/**
 * Validate Shelf/Bin location code
 */
export function validateShelfLocation(val: string): string | null {
  const trimmed = val.trim().toUpperCase();
  if (!trimmed) {
    return 'กรุณากรอกตำแหน่งชั้นวาง (Bin/Shelf)';
  }
  if (!/^[A-Z0-9][A-Z0-9\-_/]{1,19}$/.test(trimmed) || !/[A-Z]/.test(trimmed)) {
    return 'ตำแหน่งชั้นวางต้องประกอบด้วยรหัสโซนตัวอักษร เช่น A-01-01';
  }
  return null;
}

/**
 * Validate Insurance Claim Number
 */
export function validateClaimNo(val: string): string | null {
  const trimmed = val.trim().toUpperCase();
  if (!trimmed) {
    return 'กรุณากรอกเลขที่ใบเคลมประกันภัย (Claim No.)';
  }
  if (!/^[A-Z0-9][A-Z0-9\-_/]{3,29}$/.test(trimmed)) {
    return 'เลขที่ใบเคลมต้องประกอบด้วยตัวอักษร A-Z หรือตัวเลข อย่างน้อย 4 ตัวอักษร (เช่น CLM-2026-001)';
  }
  return null;
}
