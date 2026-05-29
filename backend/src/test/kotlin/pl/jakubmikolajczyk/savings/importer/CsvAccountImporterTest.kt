package pl.jakubmikolajczyk.savings.importer

import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
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

    @Test
    fun `returns null for empty label (separator row)`() {
        assertNull(importer.parsePolishMonthOrNull("", 2022))
        assertNull(importer.parsePolishMonthOrNull("   ", 2022))
    }

    @Test
    fun `returns null for goals section labels`() {
        assertNull(importer.parsePolishMonthOrNull("Cel funduszu awaryjnego:", 2022))
        assertNull(importer.parsePolishMonthOrNull("Cel FIRE:", 2022))
    }

    @Test
    fun `null-safe variant still parses valid months`() {
        assertEquals(LocalDate.of(2022, 5, 1), importer.parsePolishMonthOrNull("Maj", 2022))
        assertEquals(LocalDate.of(2022, 9, 1), importer.parsePolishMonthOrNull("Wrzesień (14.09)", 2022))
    }
}

