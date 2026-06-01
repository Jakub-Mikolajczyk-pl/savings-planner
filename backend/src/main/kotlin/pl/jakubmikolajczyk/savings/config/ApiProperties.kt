package pl.jakubmikolajczyk.savings.config

import org.springframework.boot.context.properties.ConfigurationProperties

/*
 * CONFIGURATION PROPERTIES
 *
 * Spring binds `app.security.api-token` from application.yml / ENV into this data class.
 *
 * KOTLIN data class:
 * Perfect for immutable configuration. Spring creates it once and injects it where needed.
 *
 * JAVA comparison:
 * You might write a POJO with fields/getters/setters or use a Java record.
 *
 * INTERVIEW Q: "@Value vs @ConfigurationProperties?"
 * A: @Value is okay for one property. @ConfigurationProperties groups related config,
 *    supports metadata/validation better, and keeps constructors clean.
 */
@ConfigurationProperties(prefix = "app.security")
data class SecurityProperties(
    val apiToken: String,
)

@ConfigurationProperties(prefix = "app.cors")
data class CorsProperties(
    /*
     * Spring Boot can bind comma-separated ENV:
     * CORS_ALLOWED_ORIGINS=http://localhost:5173,http://savings.lan
     * into List<String>.
     */
    val allowedOrigins: List<String>,
)

@ConfigurationProperties(prefix = "app.ingest")
data class IngestProperties(
    /*
     * NRB/IBAN values for accounts owned by Jakub, used only to detect
     * "left pocket -> right pocket" transfers in bank statements.
     *
     * Keep the real numbers in CT111 `.env`, not in git.
     */
    val internalTransferSourceAccounts: List<String> = emptyList(),
)
