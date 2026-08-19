package org.vaayu.web;

import jakarta.validation.ConstraintViolationException;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Stable client errors; malformed input never leaks a SQL or framework exception. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, ConstraintViolationException.class,
            MethodArgumentNotValidException.class})
    ResponseEntity<ApiError> badRequest(Exception exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", exception.getMessage()));
    }

    record ApiError(String code, String message, OffsetDateTime timestamp) {
        ApiError(String code, String message) {
            this(code, message, OffsetDateTime.now());
        }
    }
}
