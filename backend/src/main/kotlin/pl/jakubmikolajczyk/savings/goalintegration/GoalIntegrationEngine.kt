package pl.jakubmikolajczyk.savings.goalintegration

import pl.jakubmikolajczyk.savings.dto.GoalPaceDto
import pl.jakubmikolajczyk.savings.dto.GoalPaceStatus
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

data class GoalPaceInput(
    val goalId: UUID,
    val name: String,
    val targetAmount: BigDecimal,
    val currentSaved: BigDecimal,
    val priority: Int,
    val fixedAllocation: BigDecimal?,
)

data class CyclePaceInput(
    val isPartial: Boolean,
    val net: BigDecimal,
    val freeCash: BigDecimal,
    val savingsContribution: BigDecimal = BigDecimal.ZERO,
    val savingsWithdrawal: BigDecimal = BigDecimal.ZERO,
)

data class GoalPaceResult(
    val averageNetPerCycle: BigDecimal,
    val averageFreeCashPerCycle: BigDecimal,
    val cycleCount: Int,
    val goals: List<GoalPaceDto>,
)

/*
 * Pure business engine for EPIC 12.
 *
 * INTERVIEW Q: "Why use net plus savings movement for actual goal pace?"
 * A: free_cash is the capacity after committed costs, before discretionary
 *    spending. Net shows what survived on the operating account, while explicit
 *    savings contributions already left that account for a good reason. Goal
 *    rebuilding needs both: leftover cash plus money deliberately moved aside.
 */
class GoalIntegrationEngine {
    fun calculate(
        goals: List<GoalPaceInput>,
        cycles: List<CyclePaceInput>,
    ): GoalPaceResult {
        val fullCycles = cycles.filter { !it.isPartial }
        val averageNet = average(fullCycles.map { it.net })
        val averageFreeCash = average(fullCycles.map { it.freeCash })
        val actualCapacity = average(
            fullCycles.map { cycle -> cycle.net + cycle.savingsContribution - cycle.savingsWithdrawal },
        ).max(BigDecimal.ZERO)
        val actualPerGoal = allocateActualCapacity(goals, actualCapacity)

        return GoalPaceResult(
            averageNetPerCycle = averageNet,
            averageFreeCashPerCycle = averageFreeCash,
            cycleCount = fullCycles.size,
            goals = goals
                .sortedBy { it.priority }
                .map { goal -> toPaceDto(goal, actualPerGoal[goal.goalId] ?: BigDecimal.ZERO, fullCycles.isNotEmpty()) },
        )
    }

    private fun allocateActualCapacity(
        goals: List<GoalPaceInput>,
        actualCapacity: BigDecimal,
    ): Map<UUID, BigDecimal> {
        var pool = actualCapacity
        val allocations = mutableMapOf<UUID, BigDecimal>()
        val activeGoals = goals
            .sortedBy { it.priority }
            .filter { remainingAmount(it) > BigDecimal.ZERO }

        for (goal in activeGoals) {
            val fixed = goal.fixedAllocation
            if (fixed == null || fixed <= BigDecimal.ZERO || pool <= BigDecimal.ZERO) continue
            val amount = fixed.min(remainingAmount(goal)).min(pool)
            allocations[goal.goalId] = amount
            pool -= amount
        }

        for (goal in activeGoals.filter { it.fixedAllocation == null || it.fixedAllocation <= BigDecimal.ZERO }) {
            if (pool <= BigDecimal.ZERO) break
            val amount = remainingAmount(goal).min(pool)
            allocations[goal.goalId] = amount
            pool -= amount
        }

        return allocations
    }

    private fun toPaceDto(
        goal: GoalPaceInput,
        actualPerCycle: BigDecimal,
        hasHistory: Boolean,
    ): GoalPaceDto {
        val remaining = remainingAmount(goal)
        val plannedPerCycle = goal.fixedAllocation?.takeIf { it > BigDecimal.ZERO }
        val status = when {
            remaining <= BigDecimal.ZERO -> GoalPaceStatus.complete
            !hasHistory -> GoalPaceStatus.no_history
            actualPerCycle <= BigDecimal.ZERO -> GoalPaceStatus.unreachable
            plannedPerCycle != null && actualPerCycle < plannedPerCycle -> GoalPaceStatus.behind_plan
            else -> GoalPaceStatus.on_track
        }

        return GoalPaceDto(
            goalId = goal.goalId,
            name = goal.name,
            targetAmount = goal.targetAmount,
            currentSaved = goal.currentSaved,
            remainingAmount = remaining,
            priority = goal.priority,
            fixedAllocation = goal.fixedAllocation,
            plannedPerCycle = plannedPerCycle,
            actualPerCycle = actualPerCycle.setScale(2, RoundingMode.HALF_UP),
            projectedCycles = if (remaining > BigDecimal.ZERO && actualPerCycle > BigDecimal.ZERO) {
                remaining.divide(actualPerCycle, 0, RoundingMode.CEILING).toInt()
            } else {
                null
            },
            status = status,
        )
    }

    private fun remainingAmount(goal: GoalPaceInput): BigDecimal =
        (goal.targetAmount - goal.currentSaved).max(BigDecimal.ZERO)

    private fun average(values: List<BigDecimal>): BigDecimal =
        if (values.isEmpty()) {
            BigDecimal.ZERO.setScale(2)
        } else {
            values
                .fold(BigDecimal.ZERO) { sum, value -> sum + value }
                .divide(BigDecimal(values.size), 2, RoundingMode.HALF_UP)
        }
}
