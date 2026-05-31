package pl.jakubmikolajczyk.savings.ingest

import org.springframework.stereotype.Component
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Component
class AliorCsvAdapter : BankStatementAdapter {
    private val isoDate = DateTimeFormatter.ISO_LOCAL_DATE
    private val aliorDate = DateTimeFormatter.ofPattern("dd-MM-yyyy")

    override fun supports(bank: BankSource): Boolean = bank == BankSource.ALIOR_CSV

    override fun parse(input: InputStream): List<CanonicalTx> {
        val lines = BufferedReader(InputStreamReader(input, StandardCharsets.UTF_8)).readLines()
        val headerIndex = lines.indexOfFirst { line ->
            line.contains("Data księgowania") && line.contains("Kwota operacji")
        }
        require(headerIndex >= 0) { "Alior CSV header not found" }

        val headers = parseCsvLine(lines[headerIndex]).map { it.trim() }
        return lines.drop(headerIndex + 1)
            .filter { it.isNotBlank() }
            .mapNotNull { line -> parseRow(headers, line) }
    }

    private fun parseRow(headers: List<String>, line: String): CanonicalTx? {
        val values = parseCsvLine(line)
        if (values.all { it.isBlank() }) return null

        val row = headers.mapIndexed { index, header -> header to values.getOrElse(index) { "" } }.toMap()
        val bookedAt = parseDate(row.required("Data księgowania"))
        val amount = MoneyParser.parseAmount(row.firstPresent("Kwota w walucie rachunku", "Kwota operacji"))
        val currency = row.firstPresentOrNull("Waluta rachunku", "Waluta operacji")?.ifBlank { null } ?: "PLN"
        val sender = row["Nazwa nadawcy"].orEmpty().trim()
        val receiver = row["Nazwa odbiorcy"].orEmpty().trim()

        return CanonicalTx(
            bookedAt = bookedAt,
            amount = amount,
            currency = currency.uppercase(),
            description = row.required("Szczegóły transakcji").trim(),
            counterparty = chooseCounterparty(amount.signum(), sender, receiver),
            raw = row,
        )
    }

    private fun parseDate(raw: String): LocalDate {
        val value = raw.trim()
        return runCatching { LocalDate.parse(value, isoDate) }
            .getOrElse { LocalDate.parse(value, aliorDate) }
    }

    private fun chooseCounterparty(sign: Int, sender: String, receiver: String): String? {
        val preferred = if (sign < 0) receiver else sender
        return preferred.ifBlank {
            if (sign < 0) sender else receiver
        }.ifBlank { null }
    }

    internal fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        var index = 0

        while (index < line.length) {
            val char = line[index]
            when {
                char == '"' && inQuotes && line.getOrNull(index + 1) == '"' -> {
                    current.append('"')
                    index++
                }
                char == '"' -> inQuotes = !inQuotes
                char == ';' && !inQuotes -> {
                    result.add(current.toString())
                    current.clear()
                }
                else -> current.append(char)
            }
            index++
        }

        result.add(current.toString())
        return result
    }

    private fun Map<String, String>.required(header: String): String =
        this[header]?.takeIf { it.isNotBlank() } ?: throw IllegalArgumentException("Missing Alior CSV column: $header")

    private fun Map<String, String>.firstPresent(vararg headers: String): String =
        firstPresentOrNull(*headers) ?: throw IllegalArgumentException("Missing Alior CSV column: ${headers.joinToString(" or ")}")

    private fun Map<String, String>.firstPresentOrNull(vararg headers: String): String? =
        headers.firstNotNullOfOrNull { this[it]?.takeIf { value -> value.isNotBlank() } }
}
