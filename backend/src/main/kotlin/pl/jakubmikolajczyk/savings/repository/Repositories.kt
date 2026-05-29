package pl.jakubmikolajczyk.savings.repository

import org.springframework.data.jpa.repository.JpaRepository
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.entity.AccountSnapshotEntity
import pl.jakubmikolajczyk.savings.entity.AppSettingsEntity
import pl.jakubmikolajczyk.savings.entity.DebtEntity
import pl.jakubmikolajczyk.savings.entity.GoalEntity
import pl.jakubmikolajczyk.savings.entity.MortgagePlanEntity
import pl.jakubmikolajczyk.savings.entity.PlannerOverridesEntity
import pl.jakubmikolajczyk.savings.entity.SubscriptionEntity
import pl.jakubmikolajczyk.savings.entity.UpcomingExpenseEntity
import java.time.LocalDate
import java.util.UUID

/*
 * SPRING DATA JPA REPOSITORIES
 *
 * These interfaces have no implementation in our code. Spring Data creates a proxy
 * implementation at runtime.
 *
 * JAVA comparison:
 * Same idea as Java Spring:
 *     interface AccountRepository extends JpaRepository<AccountEntity, UUID> { ... }
 *
 * KOTLIN syntax:
 *     interface X : JpaRepository<Entity, Id>
 * The colon means "extends/implements".
 *
 * INTERVIEW Q: "How does Spring Data know what query to run for findByNameIgnoreCase?"
 * A: It parses the method name. `findBy` starts a query, `Name` is the entity property,
 *    `IgnoreCase` modifies the comparison. This is called query derivation.
 *
 * INTERVIEW Q: "Repository vs DAO?"
 * A: DAO is usually persistence-technology focused. Repository is domain-collection focused.
 *    Spring Data repositories are a pragmatic mix: they hide SQL/JPA details behind an interface.
 */
interface AccountRepository : JpaRepository<AccountEntity, UUID> {
    fun findByNameIgnoreCase(name: String): AccountEntity?
}

interface AccountSnapshotRepository : JpaRepository<AccountSnapshotEntity, UUID> {
    /*
     * Return type is non-null List. Kotlin models empty history as emptyList(), not null.
     *
     * INTERVIEW Q: "Should repositories return null or empty collections?"
     * A: Empty collection. Null means "unknown/missing collection", while empty means
     *    "we looked and found no rows".
     */
    fun findByAccountIdOrderBySnapshotDate(accountId: UUID): List<AccountSnapshotEntity>

    /*
     * Nullable single result:
     * There may be no snapshot for a month, so the return type is AccountSnapshotEntity?.
     * The service handles that by creating a new entity: idempotent upsert.
     */
    fun findByAccountIdAndSnapshotDate(accountId: UUID, snapshotDate: LocalDate): AccountSnapshotEntity?
    fun deleteByAccountIdAndSnapshotDate(accountId: UUID, snapshotDate: LocalDate)
}

interface DebtRepository : JpaRepository<DebtEntity, UUID>

interface SubscriptionRepository : JpaRepository<SubscriptionEntity, UUID>

interface UpcomingExpenseRepository : JpaRepository<UpcomingExpenseEntity, UUID>

interface GoalRepository : JpaRepository<GoalEntity, UUID>

interface MortgagePlanRepository : JpaRepository<MortgagePlanEntity, Int>

interface AppSettingsRepository : JpaRepository<AppSettingsEntity, Int>

interface PlannerOverridesRepository : JpaRepository<PlannerOverridesEntity, Int>
