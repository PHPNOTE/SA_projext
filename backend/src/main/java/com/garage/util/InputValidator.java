package com.garage.util;

import com.garage.exception.GarageException.ValidationException;

import java.util.regex.Pattern;

/**
 * Centralized input validation rules across backend services to prevent
 * malformed names, phone numbers, plates, SKUs, and garbage text.
 */
public final class InputValidator {

    private static final Pattern DIGIT_PATTERN = Pattern.compile("[0-9\\u0E50-\\u0E59]");
    private static final Pattern LETTER_PATTERN = Pattern.compile("[a-zA-Z\\u0E01-\\u0E2E\\u0E40-\\u0E44]");
    private static final Pattern ASCII_DIGIT_PATTERN = Pattern.compile("[0-9]");
    private static final Pattern PHONE_CHARS_PATTERN = Pattern.compile("^[0-9-]+$");
    private static final Pattern THAI_PHONE_DIGITS_PATTERN = Pattern.compile("^0\\d{8,9}$");
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_.]{2,29}$");
    private static final Pattern SKU_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9\\-_]{2,29}$");

    private InputValidator() {}

    public static void requirePersonName(String value, String fieldLabel) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException(fieldLabel + " is required");
        }
        String trimmed = value.trim();
        if (DIGIT_PATTERN.matcher(trimmed).find()) {
            throw new ValidationException(fieldLabel + " must not contain numbers");
        }
        if (!LETTER_PATTERN.matcher(trimmed).find() || trimmed.length() < 2) {
            throw new ValidationException(fieldLabel + " must contain valid letters (at least 2 characters)");
        }
    }

    public static void requireOrgName(String value, String fieldLabel) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException(fieldLabel + " is required");
        }
        String trimmed = value.trim();
        if (DIGIT_PATTERN.matcher(trimmed).find()) {
            throw new ValidationException(fieldLabel + " must not contain numbers");
        }
        if (!LETTER_PATTERN.matcher(trimmed).find() || trimmed.length() < 2) {
            throw new ValidationException(fieldLabel + " must contain valid letters");
        }
    }

    public static void requirePhone(String value, boolean allowWalkInDash) {
        if (value == null || value.trim().isEmpty()) {
            if (allowWalkInDash) return;
            throw new ValidationException("Phone number is required");
        }
        String trimmed = value.trim();
        if (allowWalkInDash && "-".equals(trimmed)) {
            return;
        }
        if (!PHONE_CHARS_PATTERN.matcher(trimmed).matches()) {
            throw new ValidationException("Phone number must contain digits only (no letters allowed)");
        }
        String digits = trimmed.replace("-", "");
        if (!THAI_PHONE_DIGITS_PATTERN.matcher(digits).matches()) {
            throw new ValidationException("Phone number must start with 0 and contain 9-10 digits");
        }
    }

    public static void requireLicensePlate(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException("License plate required");
        }
        String trimmed = value.trim();
        if (trimmed.length() < 4 || trimmed.length() > 35) {
            throw new ValidationException("License plate length must be between 4 and 35 characters");
        }
        if (!LETTER_PATTERN.matcher(trimmed).find() || !ASCII_DIGIT_PATTERN.matcher(trimmed).find()) {
            throw new ValidationException("License plate must contain both letters and numbers");
        }
    }

    public static void requireMeaningfulText(String value, String fieldLabel) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException(fieldLabel + " is required");
        }
        String trimmed = value.trim();
        if (!LETTER_PATTERN.matcher(trimmed).find()) {
            throw new ValidationException(fieldLabel + " must contain valid text (not numbers or symbols only)");
        }
    }

    public static void requireUsername(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException("Username is required");
        }
        String trimmed = value.trim();
        if (!USERNAME_PATTERN.matcher(trimmed).matches()) {
            throw new ValidationException("Username must start with an English letter and contain only a-z, 0-9, _, . (3-30 chars)");
        }
    }

    public static void requireSku(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException("SKU is required");
        }
        String trimmed = value.trim();
        if (!SKU_PATTERN.matcher(trimmed).matches() || !Pattern.compile("[A-Za-z]").matcher(trimmed).find()) {
            throw new ValidationException("SKU must be 3-30 alphanumeric/dash characters and contain at least one letter");
        }
    }
}
