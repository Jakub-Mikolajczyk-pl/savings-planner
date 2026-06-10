package pl.jakubmikolajczyk.savings.nudges

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import pl.jakubmikolajczyk.savings.config.NudgesProperties
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

/*
 * Minimalny klient Telegram Bot API — jeden endpoint (sendMessage), zero zależności.
 * Brak tokena/chat id => isConfigured=false i wszystkie nudges są no-opem.
 */
@Component
class TelegramClient(private val properties: NudgesProperties) {

    private val log = LoggerFactory.getLogger(TelegramClient::class.java)
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

    val isConfigured: Boolean
        get() = properties.enabled
            && properties.telegramBotToken.isNotBlank()
            && properties.telegramChatId.isNotBlank()

    /** Wysyła wiadomość HTML; zwraca true przy HTTP 200. Błędy loguje, nie rzuca. */
    fun send(html: String): Boolean {
        if (!isConfigured) {
            log.debug("Telegram nudges not configured — skipping message")
            return false
        }
        return try {
            val body = listOf(
                "chat_id" to properties.telegramChatId,
                "parse_mode" to "HTML",
                "text" to html,
            ).joinToString("&") { (key, value) ->
                "$key=${URLEncoder.encode(value, StandardCharsets.UTF_8)}"
            }
            val request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.telegram.org/bot${properties.telegramBotToken}/sendMessage"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build()
            val response = http.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() == 200) {
                true
            } else {
                log.warn("Telegram sendMessage failed: HTTP {} {}", response.statusCode(), response.body())
                false
            }
        } catch (e: Exception) {
            log.warn("Telegram sendMessage failed: {}", e.message)
            false
        }
    }
}
