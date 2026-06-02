package pl.jakubmikolajczyk.savings.entity

import com.fasterxml.jackson.databind.JsonNode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/*
 * ENTITY FILE = DATABASE MODEL
 *
 * JPA entities are intentionally NOT data classes.
 *
 * KOTLIN PITFALL:
 * `data class` generates equals/hashCode from every primary-constructor property.
 * That is great for DTOs, but dangerous for JPA:
 * - lazy relations can be touched by equals/hashCode,
 * - generated id changes during persistence,
 * - Hibernate may use proxies,
 * - mutable database objects do not behave like pure values.
 *
 * JAVA comparison:
 * In Java you often see Lombok @Data on entities. That has the same trap:
 * generated equals/hashCode/toString can accidentally walk lazy relations.
 *
 * INTERVIEW Q: "Should JPA entities be immutable?"
 * A: Pure immutability fights JPA because Hibernate constructs and mutates entities.
 *    In Kotlin, using `var` and default values is pragmatic for JPA. Keep immutability
 *    at the DTO/domain boundary, not necessarily inside persistence objects.
 *
 * INTERVIEW Q: "Why default values on constructor params?"
 * A: JPA needs a no-arg constructor. The kotlin("plugin.jpa") plugin can generate one,
 *    and defaults also make tests/fixtures less verbose.
 */
@Entity
@Table(name = "accounts", schema = "finance")
class AccountEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    /*
     * `var` means mutable property. JPA/Hibernate needs to set fields when loading rows.
     *
     * KOTLIN:
     * - val = read-only property reference.
     * - var = mutable property.
     *
     * INTERVIEW Q: "Is val the same as immutable?"
     * A: Not always. `val list = mutableListOf(...)` means the reference cannot be reassigned,
     *    but the list contents can mutate. For scalar properties like String/UUID, val is
     *    effectively immutable from the outside.
     */
    var name: String = "",
    var bucket: String = "accounts",
    var currency: String = "PLN",
    @Column(name = "opened_at")
    var openedAt: LocalDate? = null,
    @Column(name = "closed_at")
    var closedAt: LocalDate? = null,
    @Column(name = "created_at", insertable = false, updatable = false)
    /*
     * `insertable = false, updatable = false` tells Hibernate: the database owns this column.
     * PostgreSQL fills it with `default now()`.
     *
     * INTERVIEW Q: "Application timestamp or database timestamp?"
     * A: Database timestamp is consistent across clients. Application timestamp is easier
     *    to mock/test. For audit created_at, DB default is fine.
     */
    var createdAt: Instant? = null,
)

@Entity
@Table(name = "account_snapshots", schema = "finance")
class AccountSnapshotEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    /*
     * LAZY relation:
     * Hibernate stores a lightweight proxy and loads Account only when needed.
     *
     * INTERVIEW Q: "What is the N+1 query problem?"
     * A: Loading N snapshots and then touching snapshot.account for each can produce
     *    1 query for snapshots + N queries for accounts. DTO mapping should be deliberate.
     *
     * Here we mostly need account.id, and Hibernate can usually provide FK identity cheaply.
     */
    var account: AccountEntity = AccountEntity(),
    @Column(name = "snapshot_date")
    var snapshotDate: LocalDate = LocalDate.now(),
    var balance: BigDecimal = BigDecimal.ZERO,
    var notes: String? = null,
    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: Instant? = null,
)

@Entity
@Table(name = "debts", schema = "finance")
class DebtEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    var name: String = "",
    @Column(name = "remaining_balance")
    var remainingBalance: BigDecimal = BigDecimal.ZERO,
    @Column(name = "monthly_payment")
    var monthlyPayment: BigDecimal = BigDecimal.ZERO,
    var kind: String = "installment",
)

/*
 * The remaining entities are intentionally thin. Business behavior lives in services/importer.
 *
 * INTERVIEW Q: "Anemic domain model: bad or okay?"
 * A: It depends. For this backend, entities are persistence records and the frontend already
 *    owns much of the planning calculation. Keeping entities thin reduces Hibernate surprises.
 *    If business rules grow, introduce domain objects separate from JPA entities.
 */

@Entity
@Table(name = "subscriptions", schema = "finance")
class SubscriptionEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    var name: String = "",
    @Column(name = "monthly_amount")
    var monthlyAmount: BigDecimal = BigDecimal.ZERO,
    var active: Boolean = true,
    var category: String? = null,
    @Column(name = "next_charge")
    var nextCharge: LocalDate? = null,
    @Column(name = "billing_period")
    var billingPeriod: String? = null,
    @Column(name = "billing_amount")
    var billingAmount: BigDecimal? = null,
    var shared: Boolean? = null,
    @Column(name = "share_count")
    var shareCount: Int? = null,
)

@Entity
@Table(name = "upcoming_expenses", schema = "finance")
class UpcomingExpenseEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    var name: String = "",
    var amount: BigDecimal = BigDecimal.ZERO,
    @Column(name = "target_month")
    var targetMonth: LocalDate = LocalDate.now(),
    @Column(name = "is_paid")
    var isPaid: Boolean = false,
)

@Entity
@Table(name = "goals", schema = "finance")
class GoalEntity(
    @Id
    var id: UUID = UUID.randomUUID(),
    var name: String = "",
    @Column(name = "target_amount")
    var targetAmount: BigDecimal = BigDecimal.ZERO,
    var deadline: LocalDate? = null,
    var priority: Int = 1,
    @Column(name = "fixed_allocation")
    var fixedAllocation: BigDecimal? = null,
    @Column(name = "current_saved")
    var currentSaved: BigDecimal? = BigDecimal.ZERO,
)

@Entity
@Table(name = "mortgage_plan", schema = "finance")
class MortgagePlanEntity(
    @Id
    var id: Int = 1,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    /*
     * JSONB singleton:
     * MortgagePlan is already a nested frontend structure. Normalizing it into many tables
     * would add complexity before we need relational queries on its internals.
     *
     * INTERVIEW Q: "When is JSONB a good choice in PostgreSQL?"
     * A: Good for rarely queried nested configuration/state. Bad for heavily filtered fields
     *    that need relational constraints, joins, or indexes from day one.
     */
    var payload: JsonNode? = null,
)

@Entity
@Table(name = "app_settings", schema = "finance")
class AppSettingsEntity(
    @Id
    var id: Int = 1,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var payload: JsonNode? = null,
)

@Entity
@Table(name = "planner_overrides", schema = "finance")
class PlannerOverridesEntity(
    @Id
    var id: Int = 1,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var payload: JsonNode? = null,
)
