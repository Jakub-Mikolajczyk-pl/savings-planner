package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.leakanalysis.LeakAnalysisService
import java.util.UUID

@RestController
@RequestMapping("/api/leak-analysis")
class LeakAnalysisController(private val service: LeakAnalysisService) {
    @Operation(summary = "Analyze spending leak lenses for one pay period")
    @GetMapping("/cycle")
    fun cycle(
        @RequestParam accountId: UUID,
        @RequestParam periodNo: Int,
    ) = service.cycle(accountId, periodNo)
}

