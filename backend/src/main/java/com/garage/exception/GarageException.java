package com.garage.exception;

public class GarageException extends RuntimeException {
    private final int status;
    private final String code;

    public GarageException(String message, int status, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    // 400 Bad Request
    public static class ValidationException extends GarageException {
        public ValidationException(String message) {
            super(message, 400, "VALIDATION_ERROR");
        }
    }

    public static class EmptyEstimateException extends GarageException {
        public EmptyEstimateException(String message) {
            super(message, 400, "EMPTY_ESTIMATE");
        }
    }

    public static class InvalidQuantityException extends GarageException {
        public InvalidQuantityException(String message) {
            super(message, 400, "INVALID_QUANTITY");
        }
    }

    public static class InvalidPriceException extends GarageException {
        public InvalidPriceException(String message) {
            super(message, 400, "INVALID_PRICE");
        }
    }

    public static class InsufficientPaymentException extends GarageException {
        public InsufficientPaymentException(String message) {
            super(message, 400, "INSUFFICIENT_PAYMENT");
        }
    }

    // 401 Unauthorized
    public static class UnauthorizedException extends GarageException {
        public UnauthorizedException(String message) {
            super(message, 401, "UNAUTHORIZED");
        }
    }

    // 403 Forbidden
    public static class AccessDeniedException extends GarageException {
        public AccessDeniedException(String message) {
            super(message, 403, "ACCESS_DENIED");
        }
    }

    // 404 Not Found
    public static class ResourceNotFoundException extends GarageException {
        public ResourceNotFoundException(String message) {
            super(message, 404, "NOT_FOUND");
        }
    }

    // 409 Conflict
    public static class DuplicateTicketException extends GarageException {
        public DuplicateTicketException(String message) {
            super(message, 409, "DUPLICATE_TICKET");
        }
    }

    public static class NoFreeBayException extends GarageException {
        public NoFreeBayException(String message) {
            super(message, 409, "NO_FREE_BAY");
        }
    }

    public static class EmptyQueueException extends GarageException {
        public EmptyQueueException(String message) {
            super(message, 409, "EMPTY_QUEUE");
        }
    }

    public static class InvalidStatusException extends GarageException {
        public InvalidStatusException(String message) {
            super(message, 409, "INVALID_STATUS");
        }
    }

    public static class PartNotReservedException extends GarageException {
        public PartNotReservedException(String message) {
            super(message, 409, "PART_NOT_RESERVED");
        }
    }

    public static class InvalidStockException extends GarageException {
        public InvalidStockException(String message) {
            super(message, 409, "INVALID_STOCK");
        }
    }

    public static class InvalidReturnQuantityException extends GarageException {
        public InvalidReturnQuantityException(String message) {
            super(message, 409, "INVALID_RETURN_QTY");
        }
    }

    public static class OverReceiptException extends GarageException {
        public OverReceiptException(String message) {
            super(message, 409, "OVER_RECEIPT");
        }
    }

    public static class PendingPartRequestException extends GarageException {
        public PendingPartRequestException(String message) {
            super(message, 409, "PENDING_PART_REQUEST");
        }
    }

    public static class DuplicateInvoiceException extends GarageException {
        public DuplicateInvoiceException(String message) {
            super(message, 409, "DUPLICATE_INVOICE");
        }
    }

    public static class StockoutException extends GarageException {
        public StockoutException(String message) {
            super(message, 409, "STOCKOUT");
        }
    }

    // 422 Unprocessable Entity
    public static class InsuranceDocsMissingException extends GarageException {
        public InsuranceDocsMissingException(String message) {
            super(message, 422, "INSURANCE_DOCS_MISSING");
        }
    }
}
