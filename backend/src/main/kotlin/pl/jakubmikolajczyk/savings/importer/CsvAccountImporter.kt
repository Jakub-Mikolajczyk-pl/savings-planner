package pl.jakubmikolajczyk.savings.importer

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.domain.toYearMonth
import pl.jakubmikolajczyk.savings.dto.CsvColumnMappingDto
import pl.jakubmikolajczyk.savings.dto.CsvImportMappingDto
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.entity.AccountSnapshotEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository
import pl.jakubmikolajczyk.savings.repository.AccountSnapshotRepository
import java.math.BigDecimal
import java.text.Normalizer
import java.time.LocalDate
import java.util.UUID

/*
 * CSV ACCOUNT IMPORTER
 *
 * This service mirrors the old spreadsheet world into normalized backend data:
 * CSV columns become accounts, CSV monthly rows become account_snapshots.
 *
 * INTERVIEW Q: "Why importer in service layer, not controller?"
 * A: It is business/application logic: parsing, mapping, idempotent DB writes.
 *    Controller only handles HTTP multipart. This class can be unit-tested directly.
 *
 * INTERVIEW Q: "Why not use a CSV library?"
 * A: For production-grade CSV with escaped quotes/newlines, use Apache Commons CSV.
 *    Here the source format is controlled and simple. The parser is kept visible for learning.
 *    If imports get more varied, replacing splitCsvLine with a library is the first refactor.
 */
@Service
class CsvAccountImporter(
    private val accounts: AccountRepository,
    private val snapshots: AccountSnapshotRepository,
) {
    /*
     * Polish month normalization:
     * CSV labels can be "Sierpień (31.08)" or "Sierpien (31.08)".
     * normalize() strips accents so both map to "sierpien".
     *
     * INTERVIEW Q: "What is Unicode normalization?"
     * A: The same human character can be encoded in multiple ways. Normalizer.Form.NFD
     *    decomposes accents so we can remove diacritic marks consistently.
     */
    private val polishMonths = mapOf(
        "styczen" to 1,
        "stycznia" to 1,
        "luty" to 2,
        "lutego" to 2,
        "marzec" to 3,
        "marca" to 3,
        "kwiecien" to 4,
        "kwietnia" to 4,
        "maj" to 5,
        "maja" to 5,
        "czerwiec" to 6,
        "czerwca" to 6,
        "lipiec" to 7,
        "lipca" to 7,
        "sierpien" to 8,
        "sierpnia" to 8,
        "wrzesien" to 9,
        "wrzesnia" to 9,
        "pazdziernik" to 10,
        "pazdziernika" to 10,
        "listopad" to 11,
        "listopada" to 11,
        "grudzien" to 12,
        "grudnia" to 12,
    )

    @Transactional
    fun import(file: MultipartFile, mapping: CsvImportMappingDto): ImportResult {
        /*
         * Sygnatura funkcji:
         *
         * fun import(file: MultipartFile, mapping: CsvImportMappingDto): ImportResult
         *
         * Java:
         * public ImportResult import(MultipartFile file, CsvImportMappingDto mapping)
         *
         * Roznica wizualna:
         * - Kotlin: nazwaParametru: Typ
         * - Java:   Typ nazwaParametru
         * - Kotlin typ zwracany jest PO parametrach: `: ImportResult`
         */
        /*
         * Entire import is transactional:
         * if parsing/upsert throws in the middle, DB changes rollback.
         *
         * INTERVIEW Q: "What transaction boundary would you choose for file import?"
         * A: For a small file (~hundreds of rows), one transaction is simplest and safe.
         *    For massive files, chunk transactions may be better to avoid long locks/memory usage.
         */
        val lines = file.inputStream.bufferedReader(Charsets.UTF_8).readLines().filter { it.isNotBlank() }
        /*
         * Lancuch wywolan:
         *
         * file.inputStream
         *     .bufferedReader(...)
         *     .readLines()
         *     .filter { it.isNotBlank() }
         *
         * Czytaj od lewej do prawej:
         * 1. wez stream z pliku,
         * 2. opakuj go readerem,
         * 3. przeczytaj wszystkie linie,
         * 4. zostaw tylko niepuste.
         *
         * `filter { it.isNotBlank() }`:
         * - `filter` bierze lambde, ktora zwraca true/false,
         * - `it` to aktualna linia,
         * - jesli true, linia zostaje.
         *
         * Java stream:
         * lines.stream().filter(line -> !line.isBlank()).toList()
         */
        if (lines.size < 2) throw BadRequestException("CSV must contain header and at least one data row")

        val delimiter = detectDelimiter(lines.first())
        val headers = splitCsvLine(lines.first(), delimiter)
        if (headers.size < 2) throw BadRequestException("CSV must contain a date column and at least one account column")

        /*
         * Functional collection pipeline:
         * - drop(1): first CSV column is month label, not account.
         * - mapNotNull: convert mapped columns to pairs, skip unmapped/skipped columns.
         * - toMap: final lookup header -> AccountEntity.
         *
         * JAVA comparison:
         * A stream pipeline with skip(1), map, filter, collect(toMap()).
         *
         * INTERVIEW Q: "mapNotNull vs map + filterNotNull?"
         * A: mapNotNull does both in one readable operation.
         */
        val accountByHeader = headers.drop(1).mapNotNull { header ->
            /*
             * Lambda z nazwanym parametrem:
             *
             * `{ header -> ... }`
             *
             * Gdy lambda ma jeden parametr, Kotlin pozwala uzyc `it`.
             * Tu wybieramy nazwe `header`, bo kod jest czytelniejszy.
             *
             * Java:
             * header -> { ... }
             */
            val columnMapping = mapping.columns[header] ?: return@mapNotNull null
            /*
             * `return@mapNotNull null`
             *
             * To jest "labeled return": wyjdz TYLKO z tej lambdy mapNotNull,
             * nie z calej funkcji import().
             *
             * Java mental model:
             * w stream.map(...) nie robisz `return` z metody, tylko zwracasz wartosc z lambdy.
             *
             * Pytanie rekrutacyjne:
             * "Co robi return@forEach / return@mapNotNull?"
             * Odp: Lokalny return z lambdy oznaczonej etykieta.
             */
            if (columnMapping.action.equals("skip", ignoreCase = true)) return@mapNotNull null
            header to resolveAccount(header, columnMapping)
            /*
             * `header to account`
             *
             * `to` tworzy Pair<A, B>. To infix function z biblioteki standardowej.
             *
             * Java:
             * Map.entry(header, account)
             */
        }.toMap()

        /*
         * linkedMapOf keeps insertion order. That makes response summaries stable in the same
         * order as CSV headers, which is nicer for UI/debugging.
         */
        val counters = linkedMapOf<UUID, Int>()
        val warnings = mutableListOf<ImportWarning>()
        /*
         * val vs var na zywo:
         *
         * `warnings` jest val, bo referencja do listy sie nie zmienia.
         * Ale sama lista jest mutable, wiec mozemy robic `warnings += ...`.
         *
         * `imported` jest var, bo zmieniamy liczbe: imported += 1.
         *
         * Pytanie rekrutacyjne:
         * "Czy val oznacza gleboka niemutowalnosc?"
         * Odp: Nie. Oznacza, ze nie przestawisz zmiennej na inny obiekt.
         */
        var imported = 0
        var maxImportedMonth: LocalDate? = null

        lines.drop(1).forEachIndexed { index, rawLine ->
            /*
             * forEachIndexed gives both row index and row value.
             *
             * KOTLIN labeled returns:
             * `return@forEachIndexed` returns from the lambda, not from the whole import()
             * function. This is one of those Kotlin things interviewers like to check.
             */
            val columns = splitCsvLine(rawLine, delimiter)
            /*
             * Pomijamy wiersze, ktore nie sa danymi miesiecznymi:
             * - pusta pierwsza kolumna => wiersz-separator (",,,,") z konca arkusza,
             * - nierozpoznany miesiac => sekcja celow na dole (np. "Cel FIRE:").
             * Bez tego import realnego arkusza wywala sie na pierwszym smieciowym wierszu.
             */
            val monthLabel = columns.firstOrNull()?.trim().orEmpty()
            if (monthLabel.isEmpty()) return@forEachIndexed
            val snapshotDate = parsePolishMonthOrNull(monthLabel, mapping.year) ?: return@forEachIndexed
            maxImportedMonth = listOfNotNull(maxImportedMonth, snapshotDate).maxOrNull()

            headers.drop(1).forEachIndexed { headerIndex, header ->
                /*
                 * Zagniezdzona lambda:
                 * Jestesmy w forEachIndexed po wierszach, a w srodku w forEachIndexed po kolumnach.
                 *
                 * `headerIndex` = indeks kolumny konta liczony od 0 po drop(1).
                 * `header` = nazwa kolumny, np. "mBank".
                 */
                val account = accountByHeader[header] ?: return@forEachIndexed
                /*
                 * UWAGA NA ETYKIETY:
                 * Mamy tu zagniezdzone `forEachIndexed`.
                 * `return@forEachIndexed` odnosi sie do najblizszej lambdy o tej nazwie.
                 *
                 * Dla poczatkujacego czesto czytelniejsza bylaby zwykla petla for.
                 * Lambdy sa krotkie, ale przy zagniezdzeniu trzeba pilnowac, skad wracasz.
                 */
                val rawAmount = columns.getOrNull(headerIndex + 1).orEmpty()
                /*
                 * `getOrNull(index)`:
                 * - zwraca element, jesli indeks istnieje,
                 * - zwraca null, jesli indeks jest poza lista.
                 *
                 * `.orEmpty()`:
                 * - dla String? zwraca string albo "".
                 *
                 * Java:
                 * String rawAmount = index < columns.size() ? columns.get(index) : "";
                 */
                val amount = parseAmount(rawAmount) ?: return@forEachIndexed
                /*
                 * Idempotency by unique key:
                 * table has unique(account_id, snapshot_date), and code reuses existing row.
                 * Running the same import twice updates balances instead of duplicating rows.
                 */
                val snapshot = snapshots.findByAccountIdAndSnapshotDate(account.id, snapshotDate)
                    ?: AccountSnapshotEntity(account = account, snapshotDate = snapshotDate)
                snapshot.balance = amount
                snapshots.save(snapshot)
                counters[account.id] = (counters[account.id] ?: 0) + 1
                /*
                 * Map update:
                 *
                 * counters[account.id]         -> odczyt z mapy, moze byc null
                 * counters[account.id] ?: 0    -> jesli null, przyjmij 0
                 * + 1                          -> zwieksz licznik
                 * counters[account.id] = ...   -> zapisz do mapy
                 */
                imported += 1

                val openedAt = account.openedAt
                if (openedAt == null || snapshotDate.isBefore(openedAt)) {
                    account.openedAt = snapshotDate
                }
            }

            if (columns.size != headers.size) {
                warnings += ImportWarning("CSV_WIDTH", "Row ${index + 2} has ${columns.size} columns, expected ${headers.size}")
                /*
                 * String template:
                 *
                 * "Row ${index + 2} has ${columns.size} columns"
                 *
                 * Java:
                 * "Row " + (index + 2) + " has " + columns.size() + " columns"
                 *
                 * `$name` dziala dla prostej zmiennej.
                 * `${expression}` dziala dla wyrazenia.
                 */
            }
        }

        accounts.saveAll(accountByHeader.values)

        val newestMonth = maxImportedMonth
        if (newestMonth != null) {
            accountByHeader.values.forEach { account ->
                val lastSnapshot = snapshots.findByAccountIdOrderBySnapshotDate(account.id).lastOrNull()?.snapshotDate
                /*
                 * Lifecycle heuristic:
                 * If an account appears in mapping but has no snapshots for >= 3 months
                 * compared to newer data, we do NOT auto-close it. We return a warning.
                 *
                 * INTERVIEW Q: "Why warning instead of automatic update?"
                 * A: Closing an account is a business decision. Heuristics should suggest,
                 *    not silently mutate important financial state.
                 */
                if (lastSnapshot != null && account.closedAt == null && lastSnapshot.plusMonths(3).isBefore(newestMonth.plusDays(1))) {
                    warnings += ImportWarning(
                        code = "POSSIBLE_CLOSED_ACCOUNT",
                        message = "Account '${account.name}' is silent for at least 3 months in newer data",
                        accountId = account.id,
                        proposedClosedAt = lastSnapshot.toYearMonth(),
                    )
                }
            }
        }

        val summaries = accountByHeader.values.map {
            /*
             * Tu lambda uzywa domyslnego `it`, bo blok jest maly.
             * `it` = aktualny AccountEntity z accountByHeader.values.
             */
            ImportedAccountSummary(
                accountId = it.id,
                name = it.name,
                snapshotsImported = counters[it.id] ?: 0,
            )
        }

        /*
         * Kotlin if is an expression: it returns a value.
         *
         * JAVA comparison:
         * Java's if is a statement; you would write return in each branch or use ?:.
         *
         * INTERVIEW Q: "Is if an expression in Kotlin?"
         * A: Yes. Same for when. That reduces temporary variables and keeps branches explicit.
         */
        return if (warnings.isEmpty()) {
            ImportResult.Success(summaries, snapshotsImported = imported)
        } else {
            ImportResult.PartialWithWarnings(summaries, warnings, snapshotsImported = imported)
        }
    }

    fun parsePolishMonth(label: String, year: Int): LocalDate =
        /*
         * Wariant rzucajacy: uzywany tam, gdzie etykieta MUSI byc miesiacem
         * (np. testy jednostkowe). Deleguje do wariantu null-safe.
         */
        parsePolishMonthOrNull(label, year)
            ?: throw BadRequestException("Unknown Polish month in '$label'")

    /*
     * Wariant null-safe: zwraca null, gdy etykieta nie jest rozpoznanym miesiacem.
     *
     * Dlaczego istnieje:
     * Realne arkusze (np. "Finanse - 2022.csv") maja po danych mnostwo PUSTYCH
     * wierszy-separatorow (",,,,") oraz sekcje celow na dole ("Cel FIRE:", ...).
     * Pusty wiersz NIE daje pustej listy kolumn, tylko liste pustych stringow,
     * wiec columns[0] = "" trafialoby do parsera i wywalalo CALY import.
     * W petli importu wolamy ten wariant i po prostu pomijamy takie wiersze.
     */
    fun parsePolishMonthOrNull(label: String, year: Int): LocalDate? {
        val normalized = normalize(label)
        // takeWhile czyta znaki dopoki sa literami: "Maj (31.05)" -> "maj".
        val monthWord = normalized.takeWhile { it.isLetter() }.trim()
        val month = polishMonths[monthWord] ?: return null
        return LocalDate.of(year, month, 1)
    }

    private fun resolveAccount(header: String, mapping: CsvColumnMappingDto): AccountEntity =
        /*
         * `when` is Kotlin's improved switch.
         *
         * Differences vs Java switch:
         * - can be expression,
         * - no fallthrough,
         * - works nicely with strings, enums, sealed types, type checks.
         *
         * INTERVIEW Q: "Why no default/else with sealed classes?"
         * A: For sealed hierarchies the compiler can check all variants. Here action is String,
         *    so we do need `else`.
         */
        when (mapping.action.lowercase()) {
            "accountid", "existing" -> {
                /*
                 * Galaz when z blokiem:
                 * Jesli potrzebujesz kilku linii, piszesz `{ ... }`.
                 * Wartosc ostatniego wyrazenia w bloku jest wartoscia calej galezi.
                 *
                 * Tutaj ostatnia linia to accounts.findById(...).orElseThrow(...)
                 * i to ona staje sie wynikiem tej galezi.
                 */
                val id = mapping.accountId ?: throw BadRequestException("Column '$header' requires accountId")
                accounts.findById(id).orElseThrow { BadRequestException("Account $id mapped from '$header' does not exist") }
            }
            "newaccount", "new" -> {
                val name = mapping.name ?: header
                accounts.findByNameIgnoreCase(name) ?: accounts.save(
                    AccountEntity(
                        name = name,
                        bucket = mapping.bucket?.name ?: throw BadRequestException("Column '$header' requires bucket"),
                        currency = mapping.currency,
                    ),
                )
            }
            else -> throw BadRequestException("Unknown mapping action '${mapping.action}' for column '$header'")
        }

    private fun detectDelimiter(line: String): Char =
        /*
         * Funkcja prywatna z expression body:
         *
         * private fun detectDelimiter(line: String): Char = if (...) ';' else ','
         *
         * Java:
         * private char detectDelimiter(String line) {
         *     return condition ? ';' : ',';
         * }
         */
        /*
         * Small heuristic: Polish/European CSVs often use semicolon because comma is decimal separator.
         */
        if (line.count { it == ';' } >= line.count { it == ',' }) ';' else ','

    private fun splitCsvLine(line: String, delimiter: Char): List<String> {
        /*
         * Tiny state machine:
         * `inQuotes` flips when we see ". Delimiters inside quotes are treated as text.
         *
         * INTERVIEW Q: "What is a state machine?"
         * A: Logic whose behavior depends on current state plus next input. Here states are:
         *    inside quoted field vs outside quoted field.
         */
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        line.forEach { char ->
            /*
             * `when` bez argumentu:
             *
             * when {
             *   warunek1 -> ...
             *   warunek2 -> ...
             *   else -> ...
             * }
             *
             * To jest czytelniejszy odpowiednik if / else if / else.
             */
            when {
                char == '"' -> inQuotes = !inQuotes
                char == delimiter && !inQuotes -> {
                    result += current.toString().trim()
                    current.clear()
                }
                else -> current.append(char)
            }
        }
        result += current.toString().trim()
        return result
    }

    internal fun parseAmount(raw: String): BigDecimal? {
        /*
         * Money parsing odporne na DWA formaty:
         * - US/arkuszowy: "3,600.00 zł"  (przecinek = tysiace, kropka = dziesietne) = 3600.00
         * - europejski:   "3.600,00 zł"  (kropka = tysiace, przecinek = dziesietne) = 3600.00
         *
         * Kluczowa zasada: separatorem DZIESIETNYM jest ten, ktory wystepuje JAKO OSTATNI.
         * Drugi (jesli jest) to separator tysiecy i go usuwamy.
         *
         * Stary kod zakladal na sztywno format europejski, wiec "3,600.00" liczyl jako 3.6.
         *
         * INTERVIEW Q: "Why return null for blank amount?"
         * A: Pusta komorka = brak snapshota. Zero to realna wartosc (konto z saldem 0).
         */
        val cleaned = raw
            .replace("zł", "", ignoreCase = true)
            .replace("PLN", "", ignoreCase = true)
            .replace(" ", "")
            .replace(" ", "") // twarda spacja (NBSP) bywa separatorem tysiecy
            .trim()
        if (cleaned.isBlank() || cleaned == "-") return null

        val lastComma = cleaned.lastIndexOf(',')
        val lastDot = cleaned.lastIndexOf('.')
        val normalized = when {
            // Oba separatory: ostatni = dziesietny, drugi = tysiace (usuwamy).
            lastComma >= 0 && lastDot >= 0 ->
                if (lastComma > lastDot) cleaned.replace(".", "").replace(",", ".")
                else cleaned.replace(",", "")
            // Tylko przecinek: 3 cyfry po nim => tysiace ("3,600"); inaczej dziesietny ("453,59").
            lastComma >= 0 ->
                if (cleaned.length - lastComma - 1 == 3) cleaned.replace(",", "")
                else cleaned.replace(",", ".")
            // Tylko kropka (lub brak): kropka jest juz dziesietna.
            else -> cleaned
        }.filter { it.isDigit() || it == '.' || it == '-' }

        return normalized.takeIf { it.isNotBlank() && it != "-" }?.toBigDecimalOrNull()
    }

    private fun normalize(value: String): String =
        /*
         * Regex "\\p{Mn}+" means "one or more Unicode non-spacing marks", i.e. accents after NFD.
         */
        Normalizer.normalize(value.lowercase().trim(), Normalizer.Form.NFD)
            .replace("\\p{Mn}+".toRegex(), "")
}
