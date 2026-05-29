package pl.jakubmikolajczyk.savings.domain

import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val isoDate: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

/*
 * EXTENSION FUNCTIONS
 *
 * KOTLIN:
 * `fun String.toMonthStart()` looks like we added a method to String.
 * We did not modify java.lang.String. The compiler turns this into a static helper function
 * with the String passed as the first argument.
 *
 * JAVA equivalent:
 *     public static LocalDate toMonthStart(String value) { ... }
 *
 * Why use it here?
 * The API contract exposes months as "YYYY-MM", but PostgreSQL stores dates as the first day
 * of the month. This conversion is used in mappers/services, so giving it a memorable name
 * makes call sites read like domain language:
 *
 *     dto.targetMonth.toMonthStart()
 *
 * INTERVIEW Q: "Are Kotlin extension functions polymorphic?"
 * A: No. They are resolved statically at compile time. They are syntactic sugar over static
 *    functions, not virtual methods added to the class.
 */
fun String.toMonthStart(): LocalDate = LocalDate.parse("$this-01", isoDate)

/*
 * Expression body:
 * `fun x(): String = ...` is shorter than `{ return ... }`.
 *
 * Use it for tiny pure functions. For bigger logic, a block body is easier to debug/read.
 */
fun LocalDate.toYearMonth(): String = "%04d-%02d".format(year, monthValue)

/*
 * This helper is intentionally boring: ISO date strings from the frontend are already
 * "YYYY-MM-DD", so DateTimeFormatter.ISO_LOCAL_DATE does the right thing.
 *
 * INTERVIEW Q: "LocalDate vs Instant?"
 * A: LocalDate is a calendar date without time zone, perfect for deadlines/charge dates.
 *    Instant is a point in time, perfect for audit timestamps like created_at.
 */
fun String.toIsoDate(): LocalDate = LocalDate.parse(this, isoDate)
