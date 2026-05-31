package pl.jakubmikolajczyk.savings.ingest

import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate

data class CanonicalTx(
    val bookedAt: LocalDate,
    val amount: BigDecimal,
    val currency: String,
    val description: String,
    val counterparty: String?,
    val raw: Map<String, Any?>,
)

enum class BankSource(val sourceValue: String) {
    ALIOR_CSV("alior_csv"),
    VELO_PDF("velo_pdf"),
}

interface BankStatementAdapter {
    fun supports(bank: BankSource): Boolean
    fun parse(input: InputStream): List<CanonicalTx>
}
