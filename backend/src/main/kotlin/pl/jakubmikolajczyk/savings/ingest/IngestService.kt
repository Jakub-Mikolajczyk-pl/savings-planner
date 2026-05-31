package pl.jakubmikolajczyk.savings.ingest

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import pl.jakubmikolajczyk.savings.domain.UnprocessableEntityException
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.io.InputStream
import java.math.RoundingMode
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID

data class IngestResultDto(
    val inserted: Int,
    val skipped: Int,
    val bank: BankSource,
    val accountId: UUID,
)

@Service
class IngestService(
    private val adapters: List<BankStatementAdapter>,
    private val accounts: AccountRepository,
    private val transactions: TransactionUpsertRepository,
) {
    @Transactional
    fun ingest(bank: BankSource, accountId: UUID, input: InputStream): IngestResultDto {
        if (!accounts.existsById(accountId)) throw NotFoundException("Account $accountId not found")

        val adapter = adapters.firstOrNull { it.supports(bank) }
            ?: throw BadRequestException("Unsupported bank source: $bank")

        val parsed = try {
            adapter.parse(input)
        } catch (ex: UnsupportedOperationException) {
            throw UnprocessableEntityException(ex.message ?: "Bank statement parser is not enabled")
        } catch (ex: IllegalArgumentException) {
            throw UnprocessableEntityException(ex.message ?: "Bank statement is not parseable")
        } catch (ex: Exception) {
            throw UnprocessableEntityException(ex.message ?: "Bank statement is not parseable")
        }

        if (parsed.isEmpty()) throw UnprocessableEntityException("Bank statement did not contain recognized transactions")

        var inserted = 0
        parsed.forEach { tx ->
            val fingerprint = fingerprint(tx, accountId)
            val didInsert = transactions.insertIgnoreDuplicate(
                TransactionInsert(
                    accountId = accountId,
                    source = bank.sourceValue,
                    fingerprint = fingerprint,
                    tx = tx,
                ),
            )
            if (didInsert) inserted++
        }

        return IngestResultDto(
            inserted = inserted,
            skipped = parsed.size - inserted,
            bank = bank,
            accountId = accountId,
        )
    }

    internal fun fingerprint(tx: CanonicalTx, accountId: UUID): String {
        val amount = tx.amount.setScale(2, RoundingMode.HALF_UP).toPlainString()
        val payload = "${tx.bookedAt}|$amount|${normalizeDescription(tx.description)}|$accountId"
        return sha256Hex(payload)
    }

    internal fun normalizeDescription(description: String): String =
        description.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)

    private fun sha256Hex(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
