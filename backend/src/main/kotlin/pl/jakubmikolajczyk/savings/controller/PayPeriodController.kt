package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorCreateDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodSettingsDto
import pl.jakubmikolajczyk.savings.payperiod.PayPeriodService
import java.util.UUID

@RestController
@RequestMapping("/api/income-anchors")
class IncomeAnchorController(private val service: PayPeriodService) {
    @Operation(summary = "List configured income anchors")
    @GetMapping
    fun list() = service.listAnchors()

    @Operation(summary = "List positive transaction counterparties that can become income anchors")
    @GetMapping("/candidates")
    fun candidates(@RequestParam(defaultValue = "25") limit: Int) = service.listCandidates(limit)

    @Operation(summary = "Mark account+counterparty as an income anchor")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody dto: IncomeAnchorCreateDto) = service.createAnchor(dto)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = service.deleteAnchor(id)
}

@RestController
@RequestMapping("/api/pay-periods")
class PayPeriodController(private val service: PayPeriodService) {
    @Operation(summary = "List pay-period summaries with income, expense, and net cashflow")
    @GetMapping
    fun list(
        @RequestParam(required = false) accountId: UUID?,
        @RequestParam(defaultValue = "100") limit: Int,
    ) = service.listPayPeriods(accountId, limit)

    @Operation(summary = "Recalculate pay periods from income anchors")
    @PostMapping("/refresh")
    fun refresh() = service.refreshPayPeriods()

    @GetMapping("/settings")
    fun settings() = service.settings()

    @PutMapping("/settings")
    fun updateSettings(@Valid @RequestBody dto: PayPeriodSettingsDto) = service.updateSettings(dto)
}
