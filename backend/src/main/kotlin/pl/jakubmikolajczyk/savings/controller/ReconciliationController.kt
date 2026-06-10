package pl.jakubmikolajczyk.savings.controller

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.dto.MonthlyActualsDto
import pl.jakubmikolajczyk.savings.dto.SnapshotSuggestionDto
import pl.jakubmikolajczyk.savings.reconciliation.ReconciliationRepository
import java.time.LocalDate
import java.time.YearMonth

@RestController
@RequestMapping("/api/reconciliation")
class ReconciliationController(private val repository: ReconciliationRepository) {

    @GetMapping("/monthly")
    fun monthly(@RequestParam(defaultValue = "6") months: Int): List<MonthlyActualsDto> =
        repository.monthlyActuals(months.coerceIn(1, 24))

    /** Propozycje sald na koniec miesiąca (domyślnie bieżącego) z transakcji. */
    @GetMapping("/snapshot-suggestions")
    fun snapshotSuggestions(@RequestParam(required = false) yearMonth: String?): List<SnapshotSuggestionDto> {
        val month = yearMonth?.let { runCatching { YearMonth.parse(it) }.getOrNull() } ?: YearMonth.now()
        return repository.snapshotSuggestions(LocalDate.of(month.year, month.month, 1))
    }
}
