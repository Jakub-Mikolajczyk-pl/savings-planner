package pl.jakubmikolajczyk.savings.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.OncePerRequestFilter

/*
 * SECURITY CONFIG
 *
 * This is intentionally simple single-tenant auth:
 * every request under the API path must include:
 *
 *     X-Api-Token: <API_TOKEN>
 *
 * No OAuth/JWT yet, because this is a private homelab finance app.
 *
 * INTERVIEW Q: "Why not JWT?"
 * A: JWT helps when many clients/services need stateless delegated identity. Here we have
 *    one owner and one backend. Static token is simpler and has a smaller failure surface.
 *
 * INTERVIEW Q: "What is stateless session management?"
 * A: The server does not store login session state. Each request carries credentials.
 */
@Configuration
@EnableConfigurationProperties(SecurityProperties::class, CorsProperties::class)
class SecurityConfig(
    private val securityProperties: SecurityProperties,
    private val corsProperties: CorsProperties,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain =
        /*
         * Kotlin DSL style:
         * `http.csrf { it.disable() }` passes a lambda to configure a builder.
         *
         * JAVA comparison:
         * http.csrf(csrf -> csrf.disable())
         *
         * INTERVIEW Q: "Why disable CSRF for token API?"
         * A: CSRF mainly protects cookie-authenticated browser sessions. This API uses an
         *    explicit custom header token and is consumed by our frontend/API clients.
         */
        http
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .addFilterBefore(ApiTokenFilter(securityProperties), UsernamePasswordAuthenticationFilter::class.java)
            .exceptionHandling {
                it.authenticationEntryPoint { _, response, _ -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED) }
            }
            .authorizeHttpRequests {
                it.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                it.requestMatchers("/actuator/health", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                it.requestMatchers("/api/**").authenticated()
                it.anyRequest().permitAll()
            }
            .build()

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        /*
         * CORS is browser protection, not backend auth.
         *
         * INTERVIEW Q: "Does CORS secure your API?"
         * A: No. CORS tells browsers which origins may read responses. curl/Postman/server-side
         *    code can still call the API. Authentication still matters.
         */
        val configuration = CorsConfiguration().apply {
            /*
             * `apply { ... }` is a Kotlin scope function.
             * It configures an object and returns the same object.
             *
             * JAVA equivalent:
             * CorsConfiguration configuration = new CorsConfiguration();
             * configuration.setAllowedOrigins(...);
             */
            allowedOrigins = corsProperties.allowedOrigins
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf(HttpHeaders.CONTENT_TYPE, "X-Api-Token")
            allowCredentials = false
        }
        return UrlBasedCorsConfigurationSource().also {
            it.registerCorsConfiguration("/**", configuration)
        }
    }
}

class ApiTokenFilter(private val properties: SecurityProperties) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        /*
         * OncePerRequestFilter guarantees this filter runs once per request dispatch.
         *
         * INTERVIEW Q: "Filter vs Interceptor?"
         * A: Servlet filters run lower in the web stack and can handle security before MVC.
         *    Spring MVC interceptors run around controller handling.
         */
        if (!request.requestURI.startsWith("/api/")) {
            filterChain.doFilter(request, response)
            return
        }

        val token = request.getHeader("X-Api-Token")
        if (token == properties.apiToken) {
            /*
             * We manually create an Authentication and put it in SecurityContext.
             * From this point Spring Security treats the request as authenticated.
             *
             * INTERVIEW Q: "What is SecurityContextHolder?"
             * A: A per-thread holder for the current Authentication. Spring Security checks it
             *    during authorization decisions.
             */
            val auth = UsernamePasswordAuthenticationToken(
                "single-tenant",
                null,
                listOf(SimpleGrantedAuthority("ROLE_USER")),
            )
            SecurityContextHolder.getContext().authentication = auth
        }

        filterChain.doFilter(request, response)
    }
}
