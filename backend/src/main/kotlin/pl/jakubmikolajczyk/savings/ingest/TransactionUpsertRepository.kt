package pl.jakubmikolajczyk.savings.ingest

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Date
import java.util.UUID

data class TransactionInsert(
    val accountId: UUID,
    val source: String,
    val fingerprint: String,
    val tx: CanonicalTx,
)

@Repository
class TransactionUpsertRepository(
    private val jdbc: NamedParameterJdbcTemplate,
    private val objectMapper: ObjectMapper,
) {
    fun insertIgnoreDuplicate(insert: TransactionInsert): Boolean =
        insertReturningIdIgnoreDuplicate(insert) != null

    fun insertReturningIdIgnoreDuplicate(insert: TransactionInsert): Long? {
        val sql = """
            insert into finance.transactions
                (account_id, booked_at, amount, currency, description, counterparty, source, fingerprint, raw)
            values
                (:accountId, :bookedAt, :amount, :currency, :description, :counterparty, :source, :fingerprint, cast(:raw as jsonb))
            on conflict (fingerprint) do nothing
            returning id
        """.trimIndent()

        val params = MapSqlParameterSource()
            .addValue("accountId", insert.accountId)
            .addValue("bookedAt", Date.valueOf(insert.tx.bookedAt))
            .addValue("amount", insert.tx.amount)
            .addValue("currency", insert.tx.currency)
            .addValue("description", insert.tx.description)
            .addValue("counterparty", insert.tx.counterparty)
            .addValue("source", insert.source)
            .addValue("fingerprint", insert.fingerprint)
            .addValue("raw", objectMapper.writeValueAsString(insert.tx.raw))

        return jdbc.query(sql, params) { rs, _ -> rs.getLong("id") }.firstOrNull()
    }
}
