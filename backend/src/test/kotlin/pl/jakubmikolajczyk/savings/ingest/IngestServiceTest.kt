package pl.jakubmikolajczyk.savings.ingest

import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import pl.jakubmikolajczyk.savings.categorization.CategorizationService
import pl.jakubmikolajczyk.savings.payperiod.PayPeriodService
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID

class IngestServiceTest {
    private val service = IngestService(
        adapters = emptyList(),
        accounts = mockk<AccountRepository>(relaxed = true),
        transactions = mockk<TransactionUpsertRepository>(relaxed = true),
        categorization = mockk<CategorizationService>(relaxed = true),
        payPeriods = mockk<PayPeriodService>(relaxed = true),
    )

    @Test
    fun `normalizes description for stable fingerprints`() {
        assertEquals("paypal sklep test", service.normalizeDescription("  PayPal   SKLEP\tTEST  "))
    }

    @Test
    fun `fingerprint includes account id`() {
        val tx = CanonicalTx(
            bookedAt = LocalDate.of(2022, 12, 30),
            amount = BigDecimal("-17.6"),
            currency = "PLN",
            description = "Oplata za autostrade",
            counterparty = "BLUE MEDIA SA",
            raw = emptyMap(),
        )

        val first = service.fingerprint(tx, UUID.fromString("00000000-0000-0000-0000-000000000001"))
        val second = service.fingerprint(tx, UUID.fromString("00000000-0000-0000-0000-000000000002"))

        assertNotEquals(first, second)
    }
}
