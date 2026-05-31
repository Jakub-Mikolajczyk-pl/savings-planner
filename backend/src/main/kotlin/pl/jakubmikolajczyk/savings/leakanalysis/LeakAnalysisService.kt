package pl.jakubmikolajczyk.savings.leakanalysis

import org.springframework.stereotype.Service
import pl.jakubmikolajczyk.savings.domain.NotFoundException
import pl.jakubmikolajczyk.savings.dto.CycleLeakAnalysisDto
import java.util.UUID

@Service
class LeakAnalysisService(
    private val repository: LeakAnalysisRepository,
) {
    private val engine = LeakAnalysisEngine()

    fun cycle(accountId: UUID, periodNo: Int): CycleLeakAnalysisDto {
        val period = repository.findPeriod(accountId, periodNo)
            ?: throw NotFoundException("Pay period $periodNo for account $accountId not found")

        return CycleLeakAnalysisDto(
            periodNo = period.periodNo,
            accountId = period.accountId,
            accountName = period.accountName,
            periodStart = period.periodStart,
            periodEnd = period.periodEnd,
            isPartial = period.isPartial,
            income = period.income,
            expense = period.expense,
            net = period.net,
            topCategories = repository.categoryRollups(accountId, periodNo),
            recurring = engine.detectRecurring(repository.recurringSamples(accountId), periodNo),
            microExpenses = repository.microExpenses(accountId, periodNo),
            deltas = engine.deltaHighlights(repository.categoryExpensePoints(accountId), periodNo),
        )
    }
}

