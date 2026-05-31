package pl.jakubmikolajczyk.savings.ingest

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import pl.jakubmikolajczyk.savings.entity.AccountEntity
import pl.jakubmikolajczyk.savings.repository.AccountRepository

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class IngestControllerIntegrationTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val accounts: AccountRepository,
) {
    @Test
    fun `Alior CSV ingest is idempotent through HTTP API`() {
        val account = accounts.save(AccountEntity(name = "Alior", bucket = "accounts"))

        performAliorImport(account.id.toString())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.inserted").value(3))
            .andExpect(jsonPath("$.skipped").value(0))
            .andExpect(jsonPath("$.bank").value("ALIOR_CSV"))
            .andExpect(jsonPath("$.accountId").value(account.id.toString()))

        performAliorImport(account.id.toString())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.inserted").value(0))
            .andExpect(jsonPath("$.skipped").value(3))
    }

    private fun performAliorImport(accountId: String) =
        mockMvc.perform(
            multipart("/api/ingest")
                .file(aliorFile())
                .param("bank", "ALIOR_CSV")
                .param("accountId", accountId)
                .header("X-Api-Token", "test-token"),
        )

    private fun aliorFile(): MockMultipartFile {
        val bytes = javaClass.getResourceAsStream("/fixtures/alior_sample.csv")?.readBytes()
            ?: error("Missing Alior fixture")
        return MockMultipartFile("file", "alior_sample.csv", MediaType.TEXT_PLAIN_VALUE, bytes)
    }

    companion object {
        @Container
        val postgres = PostgreSQLContainer("postgres:17")

        @JvmStatic
        @DynamicPropertySource
        fun datasourceProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
            registry.add("app.seed.enabled") { "false" }
        }
    }
}
