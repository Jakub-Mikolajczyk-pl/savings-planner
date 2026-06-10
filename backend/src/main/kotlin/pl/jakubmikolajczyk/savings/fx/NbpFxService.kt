package pl.jakubmikolajczyk.savings.fx

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.Instant

data class FxRatesDto(
    val source: String,
    val table: String?,
    val effectiveDate: String?,
    val fetchedAt: String,
    val rates: Map<String, BigDecimal>,
)

/*
 * Kursy średnie NBP (tabela A) — darmowe API bez klucza.
 * Cache w pamięci na 6h: NBP publikuje tabelę raz dziennie, a backend
 * nie powinien odpytywać zewnętrznego API przy każdym wejściu w Ustawienia.
 */
@Service
class NbpFxService(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(NbpFxService::class.java)
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

    @Volatile
    private var cached: FxRatesDto? = null

    @Volatile
    private var cachedAt: Instant = Instant.EPOCH

    fun rates(): FxRatesDto? {
        val current = cached
        if (current != null && Duration.between(cachedAt, Instant.now()) < Duration.ofHours(6)) {
            return current
        }
        return fetch()?.also {
            cached = it
            cachedAt = Instant.now()
        } ?: current // sieć padła => oddaj stary cache zamiast niczego
    }

    private fun fetch(): FxRatesDto? = try {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.nbp.pl/api/exchangerates/tables/A?format=json"))
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build()
        val response = http.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() != 200) {
            log.warn("NBP API returned HTTP {}", response.statusCode())
            null
        } else {
            val table = objectMapper.readTree(response.body()).firstOrNull()
            val rates = table?.get("rates")?.associate { rate ->
                rate.get("code").asText() to BigDecimal(rate.get("mid").asText())
            } ?: emptyMap()
            FxRatesDto(
                source = "NBP tabela A",
                table = table?.get("no")?.asText(),
                effectiveDate = table?.get("effectiveDate")?.asText(),
                fetchedAt = Instant.now().toString(),
                rates = rates,
            )
        }
    } catch (e: Exception) {
        log.warn("NBP fetch failed: {}", e.message)
        null
    }
}
