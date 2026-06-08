# EPIC N — <tytuł> — handover

> Dla modelu wykonującego. Samowystarczalny. Skopiuj ten plik do
> `docs/planning/EPIC-N-<slug>.md` (lub `...-handover.md`) i wypełnij.

## Cel

<jednozdaniowy cel EPIC-a>

## Stan wejściowy

<co już istnieje, na czym budujesz>

## Zakres

<co robimy / czego NIE robimy>

## Zadania

- [ ] T1 · …
- [ ] T2 · …

## Definition of Done (dla agenta kodującego)

To są sprawdzenia **na poziomie kodu** — robi je agent przed mergem:

- [ ] `npm run lint` zielony
- [ ] `npm test` zielony
- [ ] `npm run build` zielony

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

Behawioralne sprawdzenia, które potwierdza **tylko Jakub-jako-tester** na wdrożonej
aplikacji (`savings.lan`) — NIE sprawdzenia kodowe (te są w DoD wyżej).
Behawioralne = „reguły kategorii trafiają ≥80% na realnym imporcie", a NIE „testy jednostkowe zielone".

- [ ] <pierwsze sprawdzenie behawioralne na żywej aplikacji>
- [ ] <drugie sprawdzenie behawioralne>
- [ ] <trzecie sprawdzenie behawioralne>
<!-- HUMAN-VERIFY:END -->
