package com.garage.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(GarageException.class)
    public ResponseEntity<Map<String, Object>> handleGarageException(GarageException ex) {
        log.warn("GarageException [{}]: {}", ex.getCode(), ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        if (ex.getCode() != null) {
            body.put("code", ex.getCode());
        }
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(err -> err.getField() + " " + err.getDefaultMessage())
            .orElse("Validation failed");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", msg);
        body.put("code", "VALIDATION_ERROR");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("Unhandled exception: ", ex);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage() != null ? ex.getMessage() : "Internal Server Error");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
