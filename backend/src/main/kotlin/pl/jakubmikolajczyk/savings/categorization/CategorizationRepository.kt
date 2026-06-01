package pl.jakubmikolajczyk.savings.categorization

import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import org.springframework.stereotype.Repository
import pl.jakubmikolajczyk.savings.dto.CategoryDto
import pl.jakubmikolajczyk.savings.dto.CategoryKind
import pl.jakubmikolajczyk.savings.dto.CategoryRuleDto
import pl.jakubmikolajczyk.savings.dto.RuleMatchField
import pl.jakubmikolajczyk.savings.dto.RuleMatchType
import pl.jakubmikolajczyk.savings.dto.TransactionDto
import java.math.BigDecimal
import java.sql.ResultSet
import java.util.UUID

data class TransactionForCategorization(
    val id: Long,
    val description: String,
    val counterparty: String?,
    val amount: BigDecimal,
    val currency: String,
)

@Repository
class CategorizationRepository(private val jdbc: NamedParameterJdbcTemplate) {
    private val categoryMapper = RowMapper { rs: ResultSet, _: Int ->
        CategoryDto(
            id = rs.getLong("id"),
            name = rs.getString("name"),
            kind = CategoryKind.valueOf(rs.getString("kind")),
            parentId = rs.getObject("parent_id", java.lang.Long::class.java)?.toLong(),
        )
    }

    private val ruleMapper = RowMapper { rs: ResultSet, _: Int ->
        CategoryRuleDto(
            id = rs.getLong("id"),
            matchField = RuleMatchField.valueOf(rs.getString("match_field")),
            matchType = RuleMatchType.valueOf(rs.getString("match_type")),
            pattern = rs.getString("pattern"),
            categoryId = rs.getLong("category_id"),
            priority = rs.getInt("priority"),
            source = rs.getString("source"),
        )
    }

    private val engineRuleMapper = RowMapper { rs: ResultSet, _: Int ->
        CategoryRule(
            id = rs.getLong("id"),
            matchField = RuleMatchField.valueOf(rs.getString("match_field")),
            matchType = RuleMatchType.valueOf(rs.getString("match_type")),
            pattern = rs.getString("pattern"),
            categoryId = rs.getLong("category_id"),
            priority = rs.getInt("priority"),
            source = rs.getString("source"),
        )
    }

    fun listCategories(): List<CategoryDto> =
        jdbc.query(
            "select id, name, kind, parent_id from finance.categories order by lower(name), id",
            categoryMapper,
        )

    fun findCategory(id: Long): CategoryDto? =
        jdbc.query(
            "select id, name, kind, parent_id from finance.categories where id = :id",
            mapOf("id" to id),
            categoryMapper,
        ).firstOrNull()

    fun findCategoryByName(name: String): CategoryDto? =
        jdbc.query(
            "select id, name, kind, parent_id from finance.categories where lower(name) = lower(:name)",
            mapOf("name" to name),
            categoryMapper,
        ).firstOrNull()

    fun createCategory(dto: CategoryDto): CategoryDto {
        val keyHolder = GeneratedKeyHolder()
        jdbc.update(
            """
                insert into finance.categories (name, kind, parent_id)
                values (:name, :kind, :parentId)
            """.trimIndent(),
            MapSqlParameterSource()
                .addValue("name", dto.name)
                .addValue("kind", dto.kind.name)
                .addValue("parentId", dto.parentId),
            keyHolder,
            arrayOf("id"),
        )
        return findCategory(keyHolder.key!!.toLong())!!
    }

    fun updateCategory(id: Long, dto: CategoryDto): CategoryDto? {
        jdbc.update(
            """
                update finance.categories
                set name = :name, kind = :kind, parent_id = :parentId
                where id = :id
            """.trimIndent(),
            mapOf("id" to id, "name" to dto.name, "kind" to dto.kind.name, "parentId" to dto.parentId),
        )
        return findCategory(id)
    }

    fun deleteCategory(id: Long): Int =
        jdbc.update("delete from finance.categories where id = :id", mapOf("id" to id))

    fun listRules(): List<CategoryRuleDto> =
        jdbc.query(
            """
                select id, match_field, match_type, pattern, category_id, priority, source
                from finance.category_rules
                order by priority, id
            """.trimIndent(),
            ruleMapper,
        )

    fun listEngineRules(): List<CategoryRule> =
        jdbc.query(
            """
                select id, match_field, match_type, pattern, category_id, priority, source
                from finance.category_rules
                order by priority, id
            """.trimIndent(),
            engineRuleMapper,
        )

    fun findRule(id: Long): CategoryRuleDto? =
        jdbc.query(
            """
                select id, match_field, match_type, pattern, category_id, priority, source
                from finance.category_rules
                where id = :id
            """.trimIndent(),
            mapOf("id" to id),
            ruleMapper,
        ).firstOrNull()

    fun findDuplicateRule(dto: CategoryRuleDto): CategoryRuleDto? =
        jdbc.query(
            """
                select id, match_field, match_type, pattern, category_id, priority, source
                from finance.category_rules
                where match_field = :matchField
                  and match_type = :matchType
                  and lower(pattern) = lower(:pattern)
            """.trimIndent(),
            mapOf("matchField" to dto.matchField.name, "matchType" to dto.matchType.name, "pattern" to dto.pattern),
            ruleMapper,
        ).firstOrNull()

    fun createRule(dto: CategoryRuleDto): CategoryRuleDto {
        val keyHolder = GeneratedKeyHolder()
        jdbc.update(
            """
                insert into finance.category_rules (match_field, match_type, pattern, category_id, priority, source)
                values (:matchField, :matchType, :pattern, :categoryId, :priority, :source)
            """.trimIndent(),
            ruleParams(dto),
            keyHolder,
            arrayOf("id"),
        )
        return findRule(keyHolder.key!!.toLong())!!
    }

    fun updateRule(id: Long, dto: CategoryRuleDto): CategoryRuleDto? {
        jdbc.update(
            """
                update finance.category_rules
                set match_field = :matchField,
                    match_type = :matchType,
                    pattern = :pattern,
                    category_id = :categoryId,
                    priority = :priority,
                    source = :source
                where id = :id
            """.trimIndent(),
            ruleParams(dto).addValue("id", id),
        )
        return findRule(id)
    }

    fun deleteRule(id: Long): Int =
        jdbc.update("delete from finance.category_rules where id = :id", mapOf("id" to id))

    fun listTransactions(accountId: UUID?, onlyUncategorized: Boolean, limit: Int): List<TransactionDto> {
        val conditions = mutableListOf<String>()
        val params = MapSqlParameterSource().addValue("limit", limit.coerceIn(1, 500))
        if (accountId != null) {
            conditions += "account_id = :accountId"
            params.addValue("accountId", accountId)
        }
        if (onlyUncategorized) conditions += "category_id is null"

        val where = if (conditions.isEmpty()) "" else "where ${conditions.joinToString(" and ")}"
        return jdbc.query(
            """
                select id, account_id, booked_at, amount, currency, description, counterparty, source, category_id, category_locked
                from finance.transactions
                $where
                order by booked_at desc, id desc
                limit :limit
            """.trimIndent(),
            params,
        ) { rs, _ ->
            TransactionDto(
                id = rs.getLong("id"),
                accountId = rs.getObject("account_id", UUID::class.java),
                bookedAt = rs.getDate("booked_at").toLocalDate().toString(),
                amount = rs.getBigDecimal("amount"),
                currency = rs.getString("currency").trim(),
                description = rs.getString("description"),
                counterparty = rs.getString("counterparty"),
                source = rs.getString("source"),
                categoryId = rs.getObject("category_id", java.lang.Long::class.java)?.toLong(),
                categoryLocked = rs.getBoolean("category_locked"),
            )
        }
    }

    fun transactionsForRecategorization(accountId: UUID?): List<TransactionForCategorization> {
        val sql = if (accountId == null) {
            """
                select id, description, counterparty, amount, currency
                from finance.transactions
                where category_locked = false
                order by id
            """.trimIndent()
        } else {
            """
                select id, description, counterparty, amount, currency
                from finance.transactions
                where category_locked = false and account_id = :accountId
                order by id
            """.trimIndent()
        }
        return jdbc.query(sql, mapOf("accountId" to accountId)) { rs, _ ->
            TransactionForCategorization(
                id = rs.getLong("id"),
                description = rs.getString("description"),
                counterparty = rs.getString("counterparty"),
                amount = rs.getBigDecimal("amount"),
                currency = rs.getString("currency").trim(),
            )
        }
    }

    fun setTransactionCategoryIfUnlocked(transactionId: Long, categoryId: Long?): Int =
        jdbc.update(
            """
                update finance.transactions
                set category_id = :categoryId
                where id = :id and category_locked = false
            """.trimIndent(),
            mapOf("id" to transactionId, "categoryId" to categoryId),
        )

    fun setInsertedTransactionCategory(transactionId: Long, categoryId: Long): Int =
        jdbc.update(
            """
                update finance.transactions
                set category_id = :categoryId
                where id = :id and category_id is null and category_locked = false
            """.trimIndent(),
            mapOf("id" to transactionId, "categoryId" to categoryId),
        )

    fun overrideTransactionCategory(transactionId: Long, categoryId: Long?, locked: Boolean): Int =
        jdbc.update(
            """
                update finance.transactions
                set category_id = :categoryId, category_locked = :locked
                where id = :id
            """.trimIndent(),
            mapOf("id" to transactionId, "categoryId" to categoryId, "locked" to locked),
        )

    private fun ruleParams(dto: CategoryRuleDto) = MapSqlParameterSource()
        .addValue("matchField", dto.matchField.name)
        .addValue("matchType", dto.matchType.name)
        .addValue("pattern", dto.pattern)
        .addValue("categoryId", dto.categoryId)
        .addValue("priority", dto.priority)
        .addValue("source", dto.source)
}
