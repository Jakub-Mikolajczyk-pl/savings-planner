package pl.jakubmikolajczyk.savings.controller

import io.swagger.v3.oas.annotations.Operation
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import pl.jakubmikolajczyk.savings.domain.BadRequestException
import pl.jakubmikolajczyk.savings.ingest.BankSource
import pl.jakubmikolajczyk.savings.ingest.IngestService
import java.util.Locale
import java.util.UUID

@RestController
@RequestMapping("/api/ingest")
class IngestController(private val service: IngestService) {
    @Operation(summary = "Import canonical bank transactions")
    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun ingest(
        @RequestParam("bank") bank: String,
        @RequestParam("accountId") accountId: UUID,
        @RequestParam("file") file: MultipartFile,
    ) = file.inputStream.use { input ->
        /*
         * `use {}` is Kotlin's AutoCloseable helper.
         *
         * JAVA comparison:
         * try (InputStream input = file.getInputStream()) { ... }
         *
         * Even if parsing throws, the stream is closed. That matters for uploads,
         * because multipart temp files/streams should not leak handles on Windows.
         */
        if (file.isEmpty) throw BadRequestException("Uploaded bank statement file is empty")
        service.ingest(parseBank(bank), accountId, input)
    }

    private fun parseBank(raw: String): BankSource =
        runCatching { BankSource.valueOf(raw.trim().uppercase(Locale.ROOT)) }
            .getOrElse { throw BadRequestException("Unsupported bank source: $raw") }
}
