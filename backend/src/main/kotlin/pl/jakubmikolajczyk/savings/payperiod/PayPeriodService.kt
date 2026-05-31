package pl.jakubmikolajczyk.savings.payperiod

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorCreateDto
import pl.jakubmikolajczyk.savings.dto.IncomeAnchorDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodRefreshResultDto
import pl.jakubmikolajczyk.savings.dto.PayPeriodSettingsDto
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.util.UUID

@Service
class PayPeriodService(
    private val repository: PayPeriodRepository,
    private val accounts: AccountRepository,
) {
    private val engine = PayPeriodEngine()

    fun listAnchors(): List<IncomeAnchorDto> = repository.listAnchors()

    fun listCandidates(limit: Int) = repository.listCandidates(limit)

    @Transactional
    fun createAnchor(dto: IncomeAnchorCreateDto): IncomeAnchorDto {
        if (!accounts.existsById(dto.accountId)) throw NotFoundException("Account ${dto.accountId} not found")
        if (normalizeCounterparty(dto.counterparty).isBlank()) throw BadRequestException("Counterparty cannot be blank")

        val anchor = repository.createAnchor(dto.accountId, dto.counterparty)
        refreshPayPeriods()
        return anchor
    }

    @Transactional
    fun deleteAnchor(id: Long) {
        if (repository.deleteAnchor(id) == 0) throw NotFoundException("Income anchor $id not found")
        refreshPayPeriods()
    }

    fun settings(): PayPeriodSettingsDto = repository.settings()

    @Transactional
    fun updateSettings(dto: PayPeriodSettingsDto): PayPeriodSettingsDto {
        if (dto.minCycleDays < 1) throw BadRequestException("minCycleDays must be at least 1")
        val updated = repository.updateSettings(dto)
        refreshPayPeriods()
        return updated
    }

    fun listPayPeriods(accountId: UUID?, limit: Int): List<PayPeriodDto> =
        repository.listPayPeriods(accountId, limit)

    @Transactional
    fun refreshPayPeriods(): PayPeriodRefreshResultDto {
        val minCycleDays = repository.settings().minCycleDays
        val periods = engine.calculate(repository.anchorTransactions(), minCycleDays)
        repository.replacePayPeriods(periods)
        return PayPeriodRefreshResultDto(periods = periods.size)
    }
}
