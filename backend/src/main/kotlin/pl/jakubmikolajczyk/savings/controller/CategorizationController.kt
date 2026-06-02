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
import pl.jakubmikolajczyk.savings.categorization.CategorizationService
import pl.jakubmikolajczyk.savings.dto.CategoryDto
import pl.jakubmikolajczyk.savings.dto.CategoryRuleDto
import pl.jakubmikolajczyk.savings.dto.RecategorizeRequestDto
import pl.jakubmikolajczyk.savings.dto.TransactionCategoryOverrideDto
import pl.jakubmikolajczyk.savings.payperiod.PayPeriodService
import java.util.UUID

@RestController
@RequestMapping("/api/categories")
class CategoryController(private val service: CategorizationService) {
    @GetMapping fun list() = service.listCategories()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: CategoryDto) = service.createCategory(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: Long, @Valid @RequestBody dto: CategoryDto) = service.updateCategory(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: Long) = service.deleteCategory(id)
}

@RestController
@RequestMapping("/api/category-rules")
class CategoryRuleController(private val service: CategorizationService) {
    @GetMapping fun list() = service.listRules()
    @PostMapping @ResponseStatus(HttpStatus.CREATED) fun create(@Valid @RequestBody dto: CategoryRuleDto) = service.createRule(dto)
    @PutMapping("/{id}") fun update(@PathVariable id: Long, @Valid @RequestBody dto: CategoryRuleDto) = service.updateRule(id, dto)
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) fun delete(@PathVariable id: Long) = service.deleteRule(id)
}

@RestController
@RequestMapping("/api/transactions")
class TransactionController(private val service: CategorizationService) {
    @Operation(summary = "List imported bank transactions")
    @GetMapping
    fun list(
        @RequestParam(required = false) accountId: UUID?,
        @RequestParam(required = false) periodNo: Int?,
        @RequestParam(defaultValue = "false") onlyUncategorized: Boolean,
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(defaultValue = "200") limit: Int,
    ) = service.listTransactions(accountId, periodNo, onlyUncategorized, categoryId, limit)

    @Operation(summary = "Manually override one transaction category")
    @PutMapping("/{id}/category")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun overrideCategory(
        @PathVariable id: Long,
        @RequestBody dto: TransactionCategoryOverrideDto,
    ) = service.overrideTransactionCategory(id, dto)
}

@RestController
@RequestMapping("/api/recategorize")
class RecategorizeController(
    private val service: CategorizationService,
    private val payPeriods: PayPeriodService,
) {
    @Operation(summary = "Re-run category rules for unlocked transactions")
    @PostMapping
    fun recategorize(@RequestBody(required = false) dto: RecategorizeRequestDto?) =
        service.recategorize(dto?.accountId, dto?.afterTransactionId).also {
            payPeriods.refreshPayPeriods()
        }
}
