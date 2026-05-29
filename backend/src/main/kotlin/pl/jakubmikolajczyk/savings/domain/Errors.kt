package pl.jakubmikolajczyk.savings.domain

/*
 * Custom exceptions are tiny, but they carry architectural meaning:
 * services throw domain/app errors, and `GlobalExceptionHandler` translates them to HTTP.
 *
 * JAVA comparison:
 * Kotlin classes can be one-liners when they only extend another class.
 *
 * INTERVIEW Q: "Checked vs unchecked exceptions in Kotlin?"
 * A: Kotlin has no checked exceptions. Even Java checked exceptions are treated as unchecked
 *    from Kotlin. That is why these extend RuntimeException.
 */
class NotFoundException(message: String) : RuntimeException(message)

class BadRequestException(message: String) : RuntimeException(message)
