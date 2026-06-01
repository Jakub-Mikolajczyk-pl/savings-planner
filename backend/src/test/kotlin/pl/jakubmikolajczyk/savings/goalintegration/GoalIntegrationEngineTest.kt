package pl.jakubmikolajczyk.savings.goalintegration

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import pl.jakubmikolajczyk.savings.dto.GoalPaceStatus
import java.math.BigDecimal
import java.util.UUID

class GoalIntegrationEngineTest {
    private val engine = GoalIntegrationEngine()

    @Test
    fun `uses average net from full cycles and allocates it through fixed goals first`() {
        val fixedGoal = goal("Poduszka", priority = 1, target = "1000.00", current = "100.00", fixed = "300.00")
        val flexibleGoal = goal("Wakacje", priority = 2, target = "2000.00")

        val result = engine.calculate(
            goals = listOf(fixedGoal, flexibleGoal),
            cycles = listOf(
                cycle(net = "1000.00", freeCash = "1500.00"),
                cycle(net = "500.00", freeCash = "1000.00"),
                cycle(net = "10000.00", freeCash = "10000.00", partial = true),
            ),
        )

        assertEquals(2, result.cycleCount)
        assertEquals(BigDecimal("750.00"), result.averageNetPerCycle)
        assertEquals(BigDecimal("1250.00"), result.averageFreeCashPerCycle)
        assertEquals(BigDecimal("300.00"), result.goals[0].actualPerCycle)
        assertEquals(BigDecimal("450.00"), result.goals[1].actualPerCycle)
        assertEquals(3, result.goals[0].projectedCycles)
        assertEquals(GoalPaceStatus.on_track, result.goals[0].status)
    }

    @Test
    fun `marks incomplete goals unreachable when real net is not positive`() {
        val result = engine.calculate(
            goals = listOf(goal("Remont", priority = 1, target = "1000.00")),
            cycles = listOf(cycle(net = "-100.00", freeCash = "700.00")),
        )

        assertEquals(BigDecimal("-100.00"), result.averageNetPerCycle)
        assertEquals(BigDecimal("0.00"), result.goals.single().actualPerCycle)
        assertNull(result.goals.single().projectedCycles)
        assertEquals(GoalPaceStatus.unreachable, result.goals.single().status)
    }

    @Test
    fun `marks pace as no history before full cycles exist`() {
        val result = engine.calculate(
            goals = listOf(goal("Fundusz", priority = 1, target = "1000.00")),
            cycles = listOf(cycle(net = "900.00", freeCash = "900.00", partial = true)),
        )

        assertEquals(0, result.cycleCount)
        assertEquals(GoalPaceStatus.no_history, result.goals.single().status)
    }

    private fun goal(
        name: String,
        priority: Int,
        target: String,
        current: String = "0.00",
        fixed: String? = null,
    ) = GoalPaceInput(
        goalId = UUID.randomUUID(),
        name = name,
        targetAmount = BigDecimal(target),
        currentSaved = BigDecimal(current),
        priority = priority,
        fixedAllocation = fixed?.let(::BigDecimal),
    )

    private fun cycle(net: String, freeCash: String, partial: Boolean = false) =
        CyclePaceInput(isPartial = partial, net = BigDecimal(net), freeCash = BigDecimal(freeCash))
}
