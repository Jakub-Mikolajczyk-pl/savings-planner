package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import pl.jakubmikolajczyk.savings.dto.CsvImportMappingDto
import pl.jakubmikolajczyk.savings.importer.CsvAccountImporter

/*
 * Multipart endpoint:
 * The request contains two parts:
 * - file: uploaded CSV,
 * - mapping: JSON describing how columns map to accounts.
 *
 * INTERVIEW Q: "When use multipart/form-data?"
 * A: When the request mixes binary/file data with structured fields. JSON-only requests
 *    are cleaner for normal API commands, but file upload needs multipart.
 *
 * INTERVIEW Q: "Why keep importer logic outside the controller?"
 * A: So parser/upsert behavior can be unit-tested without MockMvc/HTTP.
 */
@RestController
@RequestMapping("/api/import")
class ImportController(private val importer: CsvAccountImporter) {
    @Operation(summary = "Import account snapshots from yearly finance CSV")
    @PostMapping("/account-snapshots", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun importAccountSnapshots(
        @RequestPart("file") file: MultipartFile,
        @Valid @RequestPart("mapping") mapping: CsvImportMappingDto,
    ) = importer.import(file, mapping)
}
