package pl.jakubmikolajczyk.savings.importer

import java.util.UUID

/*
 * IMPORT RESULT MODELS
 *
 * These DTOs are returned by POST /api/import/account-snapshots.
 * They are not JPA entities; nothing here is mapped to a table.
 */
data class ImportedAccountSummary(
    val accountId: UUID,
    val name: String,
    val snapshotsImported: Int,
)

data class ImportWarning(
    val code: String,
    val message: String,
    val accountId: UUID? = null,
    val proposedClosedAt: String? = null,
)

/*
 * SEALED INTERFACE
 *
 * A sealed interface closes the result family. The compiler knows that ImportResult can only
 * be Success or PartialWithWarnings in this package/file hierarchy.
 *
 * JAVA comparison:
 * Java 21 also has sealed interfaces:
 *     public sealed interface ImportResult permits Success, PartialWithWarnings { ... }
 *
 * Why not one class with nullable warnings/errors?
 * Because the shape tells the truth:
 * - Success means clean import.
 * - PartialWithWarnings means import worked, but user should review warnings.
 *
 * INTERVIEW Q: "Sealed class/interface vs enum?"
 * A: Enum is a fixed list of constants with the same fields. Sealed hierarchy allows each
 *    variant to carry different data and behavior while staying compiler-known.
 *
 * INTERVIEW Q: "Why expose status if the type already says it?"
 * A: JSON clients do not know Kotlin sealed types. `status` is a simple discriminator for React.
 */
sealed interface ImportResult {
    val status: String
    val accounts: List<ImportedAccountSummary>
    val warnings: List<ImportWarning>

    data class Success(
        override val accounts: List<ImportedAccountSummary>,
        override val warnings: List<ImportWarning> = emptyList(),
        val snapshotsImported: Int,
    ) : ImportResult {
        override val status: String = "success"
    }

    data class PartialWithWarnings(
        override val accounts: List<ImportedAccountSummary>,
        override val warnings: List<ImportWarning>,
        val snapshotsImported: Int,
    ) : ImportResult {
        override val status: String = "partial_with_warnings"
    }
}
