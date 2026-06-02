package pl.jakubmikolajczyk.savings.goalintegration

import org.springframework.stereotype.Service
import pl.jakubmikolajczyk.savings.dto.GoalInsightsDto
import java.util.UUID

@Service
class GoalIntegrationService(
    private val repository: GoalIntegrationRepository,
) {
    private val engine = GoalIntegrationEngine()

    fun insights(accountId: UUID?, cycles: Int): GoalInsightsDto {
        val limit = cycles.coerceIn(1, 24)
        val recentCycles = repository.listFreeCashCycles(accountId, limit)
        val pace = engine.calculate(
            goals = repository.listGoalInputs(),
            cycles = recentCycles.map { cycle ->
                CyclePaceInput(
                    isPartial = cycle.isPartial,
                    net = cycle.net,
                    freeCash = cycle.freeCash,
                    savingsContribution = cycle.savingsContribution,
                    savingsWithdrawal = cycle.savingsWithdrawal,
                )
            },
        )

        return GoalInsightsDto(
            currentCycle = recentCycles.firstOrNull(),
            recentCycles = recentCycles,
            cycleCount = pace.cycleCount,
            averageNetPerCycle = pace.averageNetPerCycle,
            averageFreeCashPerCycle = pace.averageFreeCashPerCycle,
            goals = pace.goals,
        )
    }
}
