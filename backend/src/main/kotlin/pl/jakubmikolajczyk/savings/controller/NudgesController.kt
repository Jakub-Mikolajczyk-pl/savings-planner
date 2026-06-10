package pl.jakubmikolajczyk.savings.controller

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.jakubmikolajczyk.savings.nudges.NudgeService

data class NudgeTestResult(val sent: Boolean, val message: String)

@RestController
@RequestMapping("/api/nudges")
class NudgesController(private val service: NudgeService) {

    /** Ręczne wyzwolenie nudges — do weryfikacji konfiguracji Telegrama. */
    @PostMapping("/test")
    fun test(): NudgeTestResult {
        val (sent, message) = service.sendTest()
        return NudgeTestResult(sent, message)
    }
}
