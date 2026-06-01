package pl.jakubmikolajczyk.savings.ingest

import pl.jakubmikolajczyk.savings.config.IngestProperties
import java.math.BigDecimal

class InternalTransferDetector(
    ingestProperties: IngestProperties = IngestProperties(),
) {
    private val sourceAccounts = ingestProperties.internalTransferSourceAccounts
        .map(::normalizeAccountNumber)
        .filter { it.isNotBlank() }
        .toSet()

    fun isIncomingFromOwnSourceAccount(amount: BigDecimal, description: String): Boolean =
        amount > BigDecimal.ZERO &&
            sourceAccounts.isNotEmpty() &&
            sourceAccounts.any { normalizeAccountNumber(description).contains(it) }
}

fun normalizeAccountNumber(value: String): String =
    value.filter(Char::isDigit)
