package pl.jakubmikolajczyk.savings.ingest

import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import pl.jakubmikolajczyk.savings.config.IngestProperties
import org.springframework.stereotype.Component
import java.io.InputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Component
class VeloPdfAdapter(
    ingestProperties: IngestProperties = IngestProperties(),
) : BankStatementAdapter {
    private val isoDate = DateTimeFormatter.ISO_LOCAL_DATE
    private val polishDate = DateTimeFormatter.ofPattern("dd.MM.yyyy")
    private val dashedDate = DateTimeFormatter.ofPattern("dd-MM-yyyy")
    private val yearFirstDotDate = DateTimeFormatter.ofPattern("yyyy.MM.dd")
    private val datePattern = Regex("""\b(\d{4}[-.]\d{2}[-.]\d{2}|\d{2}[.-]\d{2}[.-]\d{4})\b""")
    private val dateCellPattern = Regex("""^(\d{4}[-.]\d{2}[-.]\d{2}|\d{2}[.-]\d{2}[.-]\d{4})$""")
    private val amountPattern = Regex("""([+\-\u2212]?\d[\d .\u00a0]*[,.]\d{2})\s*(PLN)?""")
    private val amountCellPattern = Regex("""^[+\-\u2212]?\d[\d .\u00a0]*[,.]\d{2}\s*(PLN)?$""")
    private val summaryStartPattern = Regex("""^(Obroty|Saldo)\b""", RegexOption.IGNORE_CASE)
    private val internalTransferSourceAccounts = ingestProperties.internalTransferSourceAccounts
        .map(::normalizeAccountNumber)
        .filter { it.isNotBlank() }
        .toSet()

    override fun supports(bank: BankSource): Boolean = bank == BankSource.VELO_PDF

    override fun parse(input: InputStream): List<CanonicalTx> {
        val bytes = input.readBytes()
        val text = Loader.loadPDF(bytes).use { document -> PDFTextStripper().getText(document) }
        return parseText(text)
    }

    internal fun parseText(text: String): List<CanonicalTx> {
        val lines = text.lineSequence()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .toList()

        val tableRows = parseTableRows(lines)
        if (tableRows.isNotEmpty()) return tableRows

        return lines.mapNotNull { parseLine(it) }
    }

    private fun parseTableRows(lines: List<String>): List<CanonicalTx> {
        val rowStarts = lines.indices
            .filter { index -> isDateCell(lines[index]) && lines.getOrNull(index + 1)?.let(::isDateCell) == true }

        if (rowStarts.isEmpty()) return emptyList()

        return rowStarts.mapNotNull { start ->
            val nextStart = rowStarts.firstOrNull { it > start } ?: lines.size
            parseTableRow(lines.subList(start, nextStart))
        }
    }

    private fun parseTableRow(rowLines: List<String>): CanonicalTx? {
        if (rowLines.size < 4 || !isDateCell(rowLines[0]) || !isDateCell(rowLines[1])) return null

        val usableLines = rowLines.takeWhile { !summaryStartPattern.containsMatchIn(it) }
        val amountCells = usableLines
            .mapIndexedNotNull { index, line -> if (isAmountCell(line)) IndexedAmount(index, line) else null }

        if (amountCells.size < 2) return null

        val transactionAmount = amountCells[amountCells.lastIndex - 1]
        val description = usableLines
            .drop(2)
            .take(transactionAmount.index - 2)
            .filterNot(::isAmountCell)
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .ifBlank { "Velo transaction" }

        val amount = MoneyParser.parseAmount(transactionAmount.raw)
        val normalizedDescription = description.replace(Regex("\\s+"), " ").trim()
        val canonicalDescription = if (isInternalIncomingTransfer(amount, normalizedDescription)) {
            "Przelew wlasny $normalizedDescription"
        } else {
            normalizedDescription
        }

        return CanonicalTx(
            bookedAt = parseDate(rowLines[0]),
            amount = amount,
            currency = "PLN",
            description = canonicalDescription,
            counterparty = null,
            raw = mapOf("lines" to usableLines),
        )
    }

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

        val amount = MoneyParser.parseAmount(rawAmount)
        val canonicalDescription = if (isInternalIncomingTransfer(amount, description)) {
            "Przelew wlasny $description"
        } else {
            description
        }

        return CanonicalTx(
            bookedAt = parseDate(dateMatch.value),
            amount = amount,
            currency = currency.uppercase(),
            description = canonicalDescription,
            counterparty = null,
            raw = mapOf("line" to line),
        )
    }

    private fun parseDate(raw: String): LocalDate =
        runCatching { LocalDate.parse(raw, isoDate) }
            .recoverCatching { LocalDate.parse(raw, yearFirstDotDate) }
            .recoverCatching { LocalDate.parse(raw, polishDate) }
            .getOrElse { LocalDate.parse(raw, dashedDate) }

    private fun isDateCell(line: String): Boolean = dateCellPattern.matches(line)

    private fun isAmountCell(line: String): Boolean = amountCellPattern.matches(line)

    private fun isInternalIncomingTransfer(amount: BigDecimal, description: String): Boolean =
        amount > BigDecimal.ZERO &&
            internalTransferSourceAccounts.isNotEmpty() &&
            internalTransferSourceAccounts.any { normalizeAccountNumber(description).contains(it) }
}

private data class IndexedAmount(
    val index: Int,
    val raw: String,
)

private fun normalizeAccountNumber(value: String): String =
    value.filter(Char::isDigit)
