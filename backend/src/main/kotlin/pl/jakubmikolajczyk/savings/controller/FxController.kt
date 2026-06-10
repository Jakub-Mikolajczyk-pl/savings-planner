package pl.jakubmikolajczyk.savings.controller

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import pl.jakubmikolajczyk.savings.fx.FxRatesDto
import pl.jakubmikolajczyk.savings.fx.NbpFxService

@RestController
@RequestMapping("/api/fx")
class FxController(private val service: NbpFxService) {

    @GetMapping("/rates")
    fun rates(): FxRatesDto =
        service.rates() ?: throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "NBP API niedostępne")
}
