package pl.jakubmikolajczyk.savings.ingest

import java.math.BigDecimal
import java.math.RoundingMode

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
