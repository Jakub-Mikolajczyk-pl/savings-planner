package pl.jakubmikolajczyk.savings.categorization

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import pl.jakubmikolajczyk.savings.config.LlmProperties
import pl.jakubmikolajczyk.savings.dto.CategoryDto
import java.math.BigDecimal
import java.time.Duration

@Component
class OllamaLlmCategorySuggester(
    private val properties: LlmProperties,
    private val objectMapper: ObjectMapper,
) : LlmCategorySuggester {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val parser = LlmCategorySuggestionParser(objectMapper)
    private val restClient: RestClient by lazy { buildClient() }

    override fun suggest(input: LlmCategorizationInput, categories: List<CategoryDto>): LlmCategoryDecision {
        if (!properties.enabled || categories.isEmpty()) return LlmCategoryDecision(LlmCategoryOutcome.disabled)

        return runCatching {
            val response = restClient.post()
                .uri("/api/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    OllamaGenerateRequest(
                        model = properties.model,
                        prompt = prompt(input, categories),
                    ),
                )
                .retrieve()
                .body(OllamaGenerateResponse::class.java)

            val suggestion = parser.parse(response?.response.orEmpty())
                ?: return@runCatching LlmCategoryDecision(LlmCategoryOutcome.parse_error)

            when {
                suggestion.categoryId == null && suggestion.categoryName == null ->
                    LlmCategoryDecision(LlmCategoryOutcome.no_category, suggestion)
                (suggestion.confidence ?: BigDecimal.ONE) < properties.minConfidence ->
                    LlmCategoryDecision(LlmCategoryOutcome.low_confidence, suggestion)
                else ->
                    LlmCategoryDecision(LlmCategoryOutcome.categorized, suggestion)
            }
        }.getOrElse { error ->
            logger.warn("LLM categorization skipped after Ollama error: {}", error.message)
            LlmCategoryDecision(LlmCategoryOutcome.transport_error)
        }
    }

    private fun buildClient(): RestClient =
        RestClient.builder()
            .baseUrl(properties.baseUrl.trimEnd('/'))
            .requestFactory(
                SimpleClientHttpRequestFactory().apply {
                    val timeout = Duration.ofSeconds(properties.timeoutSeconds.coerceAtLeast(1))
                    setConnectTimeout(timeout)
                    setReadTimeout(timeout)
                },
            )
            .build()

    private fun prompt(input: LlmCategorizationInput, categories: List<CategoryDto>): String {
        val categoryPayload = categories.map { category ->
            mapOf(
                "id" to category.id,
                "name" to category.name,
                "kind" to category.kind.name,
                "hint" to categoryHint(category.name),
            )
        }
        val transactionPayload = mapOf(
            "description" to input.description,
            "counterparty" to input.counterparty,
            "amount" to input.amount,
            "currency" to input.currency,
        )

        return """
            Jestes klasyfikatorem transakcji bankowych w prywatnej aplikacji finansowej.
            Wybierz categoryId z listy kategorii. Nie wymyslaj nowych kategorii.
            Dla zwyklych wydatkow wybierz najlepsza pasujaca kategorie.
            Jesli merchant jest nieznany, ale to wyglada jak normalny wydatek, wybierz kategorie Inne.
            categoryId null zwracaj tylko gdy opis jest zbyt pusty/sprzeczny, zeby podjac decyzje.
            Zwracaj wylacznie poprawny JSON w formacie:
            {"categoryId":123,"confidence":0.0}

            Przyklady:
            - BIEDRONKA, LIDL, ZABKA, KAUFLAND, AUCHAN, CARREFOUR => Zakupy spozywcze
            - APTEKA, DOZ, GEMINI, lekarz, przychodnia => Zdrowie
            - ORLEN, BP, SHELL, parking, bilet, AUTOPAY => Transport
            - NETFLIX, SPOTIFY, GOOGLE, APPLE.COM, subskrypcja => Abonamenty
            - NETIA, prad, gaz, internet, telefon => Media i internet
            - ZUS, urzad skarbowy, mikrorachunek => Podatki i ZUS
            - wynagrodzenie, pensja, salary => Przychody
            - przelew wlasny, transfer miedzy kontami => Transfery
            - dziwny merchant, ale normalny zakup/usluga => Inne

            Kategorie:
            ${objectMapper.writeValueAsString(categoryPayload)}

            Transakcja:
            ${objectMapper.writeValueAsString(transactionPayload)}
        """.trimIndent()
    }

    private fun categoryHint(name: String): String =
        when (name.lowercase()) {
            "zakupy spozywcze" -> "supermarkety, dyskonty, sklepy spozywcze, convenience stores"
            "podatki i zus" -> "ZUS, urzad skarbowy, mikrorachunek, podatki"
            "media i internet" -> "rachunki za internet, prad, gaz, telefon, media domowe"
            "abonamenty" -> "subskrypcje cyfrowe i stale uslugi online"
            "transport" -> "paliwo, bilety, parking, autostrady, taksowki, komunikacja"
            "zdrowie" -> "apteki, lekarze, badania, przychodnie, uslugi medyczne"
            "przychody" -> "wynagrodzenie, pensja, inne wplywy zarobkowe"
            "transfery" -> "przelewy wlasne miedzy kontami"
            "inne" -> "fallback dla normalnych wydatkow bez lepszej kategorii"
            else -> "wybierz, gdy opis transakcji pasuje do nazwy kategorii"
        }
}

class LlmCategorySuggestionParser(private val objectMapper: ObjectMapper) {
    fun parse(rawResponse: String): LlmCategorySuggestion? {
        val json = extractJson(rawResponse) ?: return null
        val node = runCatching { objectMapper.readTree(json) }.getOrNull() ?: return null
        val categoryId = listOf("categoryId", "category_id", "id")
            .asSequence()
            .mapNotNull { field ->
                val value = node.path(field)
                when {
                    value.isIntegralNumber -> value.asLong()
                    value.isTextual -> value.asText().trim().toLongOrNull()
                    else -> null
                }
            }
            .firstOrNull()
        val categoryName = listOf("category", "categoryName", "kategoria")
            .asSequence()
            .mapNotNull { field ->
                val value = node.path(field)
                if (value.isTextual) value.asText().trim() else null
            }
            .firstOrNull { it.isNotBlank() && !it.equals("null", ignoreCase = true) }
        val confidence = listOf("confidence", "pewnosc", "score")
            .asSequence()
            .mapNotNull { field ->
                val value = node.path(field)
                when {
                    value.isNumber -> BigDecimal.valueOf(value.asDouble())
                    value.isTextual -> value.asText().toBigDecimalOrNull()
                    else -> null
                }
            }
            .firstOrNull()

        return LlmCategorySuggestion(categoryId = categoryId, categoryName = categoryName, confidence = confidence)
    }

    private fun extractJson(value: String): String? {
        val trimmed = value.trim()
            .removePrefix("```json")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed

        val start = trimmed.indexOf('{')
        val end = trimmed.lastIndexOf('}')
        return if (start >= 0 && end > start) trimmed.substring(start, end + 1) else null
    }
}

data class OllamaGenerateRequest(
    val model: String,
    val prompt: String,
    val stream: Boolean = false,
    val format: String = "json",
    val think: Boolean = false,
    val options: Map<String, Any> = mapOf(
        "temperature" to 0,
        "top_p" to 0.2,
    ),
)

data class OllamaGenerateResponse(
    val response: String? = null,
)
