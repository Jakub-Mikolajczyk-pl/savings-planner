package pl.jakubmikolajczyk.savings.controller

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.dto.MonthlyActualsDto
import pl.jakubmikolajczyk.savings.reconciliation.ReconciliationRepository

@RestController
@RequestMapping("/api/reconciliation")
class ReconciliationController(private val repository: ReconciliationRepository) {

    @GetMapping("/monthly")
    fun monthly(@RequestParam(defaultValue = "6") months: Int): List<MonthlyActualsDto> =
        repository.monthlyActuals(months.coerceIn(1, 24))
}
