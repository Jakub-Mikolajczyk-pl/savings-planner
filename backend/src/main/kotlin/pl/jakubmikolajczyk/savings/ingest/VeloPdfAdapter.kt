package pl.jakubmikolajczyk.savings.ingest

import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.springframework.stereotype.Component
import java.io.InputStream
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Component
class VeloPdfAdapter : BankStatementAdapter {
    private val isoDate = DateTimeFormatter.ISO_LOCAL_DATE
    private val polishDate = DateTimeFormatter.ofPattern("dd.MM.yyyy")
    private val dashedDate = DateTimeFormatter.ofPattern("dd-MM-yyyy")
    private val datePattern = Regex("""\b(\d{4}-\d{2}-\d{2}|\d{2}[.-]\d{2}[.-]\d{4})\b""")
    private val amountPattern = Regex("""([+\-\u2212]?\d[\d .]*[,.]\d{2})\s*(PLN)?""")

    override fun supports(bank: BankSource): Boolean = bank == BankSource.VELO_PDF

    override fun parse(input: InputStream): List<CanonicalTx> {
        val bytes = input.readBytes()
        val text = Loader.loadPDF(bytes).use { document -> PDFTextStripper().getText(document) }
        return parseText(text)
    }

    internal fun parseText(text: String): List<CanonicalTx> =
        text.lineSequence()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .mapNotNull { parseLine(it) }
            .toList()

    private fun parseLine(line: String): CanonicalTx? {
        val dateMatch = datePattern.find(line) ?: return null
        val amountMatch = amountPattern.findAll(line).lastOrNull() ?: return null
        val rawAmount = amountMatch.groupValues[1]
        val currency = amountMatch.groupValues.getOrNull(2)?.ifBlank { "PLN" } ?: "PLN"

        val description = line
            .removeRange(amountMatch.range)
            .replace(datePattern, "")
            .replace(Regex("\\s+"), " ")
            .trim()
            .ifBlank { "Velo transaction" }

        return CanonicalTx(
            bookedAt = parseDate(dateMatch.value),
            amount = MoneyParser.parseAmount(rawAmount),
            currency = currency.uppercase(),
            description = description,
            counterparty = null,
            raw = mapOf("line" to line),
        )
    }

    private fun parseDate(raw: String): LocalDate =
        runCatching { LocalDate.parse(raw, isoDate) }
            .recoverCatching { LocalDate.parse(raw, polishDate) }
            .getOrElse { LocalDate.parse(raw, dashedDate) }
}
