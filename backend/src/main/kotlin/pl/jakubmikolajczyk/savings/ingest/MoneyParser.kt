package pl.jakubmikolajczyk.savings.ingest

import java.math.BigDecimal
import java.math.RoundingMode

/*
 * `object` in Kotlin = singleton.
 *
 * JAVA comparison:
 * Similar intent to a final class with static methods, but Kotlin gives it a real
 * singleton instance. We use it here because parsing money has no per-request state.
 */
object MoneyParser {
    fun parseAmount(raw: String): BigDecimal {
        val cleaned = raw
            .trim()
            .replace('\u2212', '-')
            .replace("\u00a0", " ")
            .replace(Regex("[A-Za-złŁzZ]+"), "")
            .trim()

        require(cleaned.isNotBlank()) { "Amount is blank" }

        val withoutSpaces = cleaned.replace(" ", "")
        val lastComma = withoutSpaces.lastIndexOf(',')
        val lastDot = withoutSpaces.lastIndexOf('.')
        /*
         * This `when` is an expression assigned to decimalSeparator.
         * Notice there is no `break`: Kotlin branches do not fall through.
         *
         * The heuristic is "the last separator wins" when both comma and dot exist:
         * 3,600.00 -> dot decimal, 3.600,00 -> comma decimal.
         */
        val decimalSeparator = when {
            lastComma >= 0 && lastDot >= 0 -> if (lastComma > lastDot) ',' else '.'
            lastComma >= 0 -> if (digitsAfter(withoutSpaces, lastComma) == 2) ',' else null
            lastDot >= 0 -> if (digitsAfter(withoutSpaces, lastDot) == 2) '.' else null
            else -> null
        }

        val normalized = when (decimalSeparator) {
            ',' -> withoutSpaces.replace(".", "").replace(',', '.')
            '.' -> withoutSpaces.replace(",", "")
            else -> withoutSpaces.replace(",", "").replace(".", "")
        }

        return BigDecimal(normalized).setScale(2, RoundingMode.HALF_UP)
    }

    private fun digitsAfter(value: String, separatorIndex: Int): Int =
        value.length - separatorIndex - 1
}
