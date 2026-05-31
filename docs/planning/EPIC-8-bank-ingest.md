# EPIC 8 - bank ingest contract

## Endpoint

`POST /api/ingest`

Multipart fields:

- `bank`: `ALIOR_CSV` or `VELO_PDF`
- `accountId`: UUID of an existing account in `finance.accounts`
- `file`: bank export file

Response:

```json
{ "inserted": 42, "skipped": 11, "bank": "ALIOR_CSV", "accountId": "..." }
```

Repeating the same import is safe. The backend calculates:

```text
sha256(booked_at|amount|norm(description)|account_id)
```

and writes with `ON CONFLICT (fingerprint) DO NOTHING`.

## Alior CSV

Canonical export template:

- encoding: UTF-8
- delimiter: semicolon (`;`)
- first transaction header contains `Data księgowania`, `Szczegóły transakcji`, `Kwota operacji`
- actual Alior exports may include one criteria line before the header; the parser skips it
- supported date formats: `yyyy-MM-dd` and the current Alior export shape `dd-MM-yyyy`

Mapping:

- `Data księgowania` -> `booked_at`
- `Kwota w walucie rachunku`, fallback `Kwota operacji` -> `amount`
- `Waluta rachunku`, fallback `Waluta operacji`, fallback `PLN` -> `currency`
- `Szczegóły transakcji` -> `description`
- sender/receiver columns -> `counterparty` depending on amount sign
- full CSV row -> `raw`

## Velo PDF

Velo individual accounts do not provide CSV in the same flow, so `VELO_PDF` uses PDFBox text extraction and a conservative row parser:

- finds rows containing a booking date and the last money amount on the line
- supported date formats: `yyyy-MM-dd`, `dd.MM.yyyy`, `dd-MM-yyyy`
- supported amount formats: Polish and US decimal/thousands variants
- raw extracted line is preserved in `raw`

The parser has regression coverage for extracted Velo-like text. It still needs a real anonymized Velo PDF fixture before treating the layout as fully locked.
