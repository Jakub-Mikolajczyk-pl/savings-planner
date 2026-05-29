package pl.jakubmikolajczyk.savings.config

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import java.time.Instant

data class ApiError(
    val timestamp: Instant = Instant.now(),
    val status: Int,
    val error: String,
    val message: String,
    val path: String,
)

/*
 * GLOBAL ERROR TRANSLATION
 *
 * Services throw meaningful exceptions. This class turns them into consistent JSON.
 *
 * INTERVIEW Q: "Why centralize exception handling?"
 * A: Without @RestControllerAdvice every controller repeats try/catch and error formatting.
 *    Central handling keeps API responses consistent.
 *
 * JAVA comparison:
 * Same annotations in Java, but Kotlin data class makes the ApiError DTO very compact.
 */
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException::class)
    fun notFound(ex: NotFoundException, request: HttpServletRequest) =
        error(HttpStatus.NOT_FOUND, ex.message ?: "Not found", request)

    @ExceptionHandler(BadRequestException::class, IllegalArgumentException::class)
    fun badRequest(ex: RuntimeException, request: HttpServletRequest) =
        error(HttpStatus.BAD_REQUEST, ex.message ?: "Bad request", request)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException, request: HttpServletRequest): ResponseEntity<ApiError> {
        /*
         * joinToString is Kotlin's convenient collection formatter.
         *
         * JAVA equivalent:
         * fieldErrors.stream()
         *     .map(error -> error.getField() + ": " + error.getDefaultMessage())
         *     .collect(Collectors.joining("; "))
         *
         * INTERVIEW Q: "What HTTP status for validation errors?"
         * A: Usually 400 Bad Request. The client sent syntactically valid JSON, but invalid data.
         */
        val message = ex.bindingResult.fieldErrors.joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
        return error(HttpStatus.BAD_REQUEST, message.ifBlank { "Validation failed" }, request)
    }

    private fun error(status: HttpStatus, message: String, request: HttpServletRequest) =
        ResponseEntity.status(status).body(
            ApiError(
                status = status.value(),
                error = status.reasonPhrase,
                message = message,
                path = request.requestURI,
            ),
        )
}
