package pl.jakubmikolajczyk.savings.importer

import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import pl.jakubmikolajczyk.savings.repository.AccountSnapshotRepository
import java.time.LocalDate

class CsvAccountImporterTest {
    private val importer = CsvAccountImporter(
        accounts = mockk<AccountRepository>(relaxed = true),
        snapshots = mockk<AccountSnapshotRepository>(relaxed = true),
    )

    @Test
    fun `parses Polish month names with accents`() {
        assertEquals(LocalDate.of(2024, 8, 1), importer.parsePolishMonth("Sierpień (31.08)", 2024))
    }

    @Test
    fun `parses Polish month names without accents`() {
        assertEquals(LocalDate.of(2024, 10, 1), importer.parsePolishMonth("Pazdziernik (31.10)", 2024))
    }
}

