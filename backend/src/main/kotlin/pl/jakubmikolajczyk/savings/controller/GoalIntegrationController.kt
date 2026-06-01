package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.goalintegration.GoalIntegrationService
import java.util.UUID

@RestController
@RequestMapping("/api/goal-insights")
class GoalIntegrationController(private val service: GoalIntegrationService) {
    @Operation(summary = "Show real goal pace from pay-period cashflow")
    @GetMapping
    fun insights(
        @RequestParam(required = false) accountId: UUID?,
        @RequestParam(defaultValue = "6") cycles: Int,
    ) = service.insights(accountId, cycles)
}
