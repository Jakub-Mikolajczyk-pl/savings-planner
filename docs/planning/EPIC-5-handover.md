# EPIC 5 — Handover do implementacji (CI/CD + deploy na homelab)

Dokument wykonawczy. Cel: automatyczny build+test+deploy savings-planner na **CT111 savings-app** przez **Forgejo Actions** (runner na CT110), z obrazami w **Forgejo container registry**. Po EPIC 5 robimy ręczny E2E na żywym deployu (odłożony z EPIC 4).

> Nadrzędne: `docs/planning/ROADMAP-2026.md` (EPIC 5). Infra: `docs/planning/EPIC-0-infra.md`. Backend: `backend/` (Dockerfile gotowy, port 8080). Frontend: root (Vite). Konwencje merge/remote: brain-memory `CONVENTIONS.md`.

---

## 0. Kontekst i zasady pracy

- **Repo:** `E:\repo\savings-planner`. **Branch:** `feat/epic-5-cicd` (z `main` = 39633bf, ma EPIC 1–4).
- **Push do OBU** po zielonym chunku (origin + forgejo). Forgejo auth bywa migotliwy — retry/odśwież token.
- **Merge lokalnie → push do obu** (nie klikać „merge" w web UI — rebase Forgejo vs merge GitHub się rozjeżdża; patrz CONVENTIONS).
- Commit: `ci(...)` / `feat(deploy): ...` + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Sekrety NIGDY do repo.** Tokeny/hasła/klucze → Forgejo Actions secrets + `.env` na CT111. W repo tylko `.env.example`.
- Po EPIC 5: brain-memory done log + current_focus → „E2E na deployu, potem EPIC 6 PWA"; karta Todoist.

---

## 1. Stan infry (z EPIC 0, faktyczny)

| Element | Stan |
|---|---|
| CT110 forgejo | Forgejo `http://192.168.100.165:3000` + Actions runner online (labels `docker`, `host`), dostęp do `docker.sock` |
| CT111 savings-app | Debian + Docker, za nginx-proxy (CT103) → `savings.lan`. Tu ląduje compose (frontend+backend) |
| CT109 db-finance | Postgres 17, baza `finance`, user `app_user`, `192.168.100.164:5432` |
| Forgejo registry | wbudowany rejestr kontenerów na hoście Forgejo (`192.168.100.165:3000/jakub/...`) |
| Backend Dockerfile | `backend/Dockerfile` (multi-stage gradle→temurin 21, EXPOSE 8080) — gotowy |
| Frontend Dockerfile | **BRAK — do dodania w 5.2** |
| Workflowy | **BRAK — do dodania w 5.1/5.3** |

---

## 2. Architektura deploymentu (rekomendowana)

```
nginx-proxy (CT103)  →  savings.lan  →  CT111:80 (frontend nginx)
                                          ├─ serwuje statyczny build (dist/)
                                          └─ location /api/ → proxy_pass http://backend:8080
CT111 docker compose:  frontend(nginx)  +  backend(jvm:8080)  ──→  CT109 Postgres (192.168.100.164)
```

**Kluczowa decyzja — same-origin przez nginx:** frontend nginx serwuje statykę ORAZ proxy'uje `/api/` do kontenera backendu. Zalety:
- **Brak CORS** (front i API na tym samym originie `savings.lan`).
- **Token nie trafia do przeglądarki:** nginx dokłada `proxy_set_header X-Api-Token <token>` (z env przez `envsubst`), a frontend woła **relatywnie** (`VITE_API_BASE_URL=''` → `/api/...`). Bezpieczniej niż token w bundlu.
- Frontend client już wysyła `X-Api-Token`; nginx i tak go nadpisze — OK.

Alternatywa (prostsza, mniej bezpieczna): frontend woła backend bezpośrednio (`VITE_API_BASE_URL=http://savings.lan:8080`), token zapieczony w bundlu (`VITE_API_TOKEN`), polega na istniejącym CORS. **Rekomendacja: wariant nginx-proxy.**

---

## 3. CHUNK 5.1 — CI: build + test

**Pliki:** `.forgejo/workflows/ci.yml`.

- Trigger: `push` (wszystkie branche) + `pull_request`.
- `runs-on`: label runnera homelab (`host` lub `docker` — zweryfikuj w Forgejo → Runners).
- Joby:
  - **backend:** `cd backend && ./gradlew test build`. ⚠️ Testy backendu używają **Testcontainers** → runner musi mieć dostęp do Dockera (ma `docker.sock`). Zadbaj o `DOCKER_HOST`/socket w środowisku joba.
  - **frontend:** `npm ci && npm run lint && npm test && npm run build`.
- Cache (opcjonalnie): Gradle (`~/.gradle`), npm (`~/.npm`) — przyspiesza.

**Acceptance:** push do `feat/epic-5-cicd` odpala pipeline na runnerze; oba joby zielone (backend Testcontainers + frontend build).

---

## 4. CHUNK 5.2 — Dockeryzacja (frontend) + compose

**Pliki:** `Dockerfile` (frontend, root), `nginx.conf` (lub `nginx.conf.template` + envsubst), `docker-compose.prod.yml`, `.env.example` (prod).

- **Frontend Dockerfile** multi-stage:
  - stage build: `node:20-alpine` → `npm ci && npm run build` (z build-args `VITE_BACKEND=api`, `VITE_API_BASE_URL=` (puste, relatywne)).
  - stage runtime: `nginx:alpine`, kopiuj `dist/` → `/usr/share/nginx/html`, wstaw `nginx.conf` z:
    ```nginx
    location / { try_files $uri /index.html; }          # SPA fallback
    location /api/ {
      proxy_pass http://backend:8080;
      proxy_set_header X-Api-Token ${API_TOKEN};         # envsubst z env kontenera
      proxy_set_header Host $host;
    }
    ```
  - użyj `envsubst` na template przy starcie (entrypoint) żeby wstrzyknąć `API_TOKEN`.
- **`docker-compose.prod.yml`:**
  - `backend`: image z rejestru Forgejo, `SPRING_PROFILES_ACTIVE=prod`, env `DB_HOST=192.168.100.164`, `DB_USER`, `DB_PASSWORD`, `API_TOKEN` (z `.env`), healthcheck `/actuator/health`.
  - `frontend`: image z rejestru, port `80:80`, env `API_TOKEN`, `depends_on: backend (healthy)`.
  - sieć wspólna; backend NIE musi wystawiać 8080 na hosta (tylko w sieci compose).
- **`.env.example`** (na CT111 realny `.env`, poza repo): `DB_USER`, `DB_PASSWORD`, `API_TOKEN`, `CORS_ALLOWED_ORIGINS` (niepotrzebne przy same-origin, ale zostaw).

**Acceptance:** `docker compose -f docker-compose.prod.yml up` lokalnie (z obrazami zbudowanymi lokalnie) stawia front+back; `http://localhost` serwuje apkę, `/api/...` odpowiada (token wstrzyknięty); backend łączy się z Postgresem.

---

## 5. CHUNK 5.3 — CD: build → registry → deploy na CT111

**Pliki:** `.forgejo/workflows/deploy.yml`.

- Trigger: `push` na `main` (lub tag `v*`).
- Kroki:
  1. Build obrazów: `backend` i `frontend`, tag `:<commit-sha>` + `:latest`.
  2. Login do Forgejo registry (`docker login 192.168.100.165:3000` użyciem secret `REGISTRY_USER`/`REGISTRY_TOKEN`).
  3. Push obu obrazów.
  4. Deploy na CT111: **SSH z runnera** (secret `CT111_SSH_KEY`, host `192.168.100.166`) → w katalogu deployu `docker compose pull && docker compose up -d` (z pinem `:<sha>` przez env `IMAGE_TAG`).
- **Rollback:** obrazy tagowane SHA → rollback = redeploy poprzedniego SHA (`IMAGE_TAG=<poprzedni> docker compose up -d`). Trzymaj N ostatnich tagów.
- Sekrety (Forgejo → repo → Settings → Secrets): `REGISTRY_USER`, `REGISTRY_TOKEN`, `CT111_SSH_KEY`, `DB_PASSWORD`, `API_TOKEN`.

**Acceptance:** merge do `main` → pipeline buduje, pushuje obrazy do rejestru Forgejo, deployuje na CT111; `http://savings.lan` serwuje nową wersję bez ręcznej roboty; rollback przez redeploy poprzedniego SHA udokumentowany w README.

---

## 6. Definition of Done

- [ ] 5.1–5.3 z acceptance.
- [ ] `.forgejo/workflows/ci.yml` + `deploy.yml` działają na runnerze homelab.
- [ ] Frontend Dockerfile + nginx (same-origin proxy + token injection) + `docker-compose.prod.yml`.
- [ ] Obrazy w Forgejo registry tagowane SHA; deploy na CT111 automatyczny; rollback udokumentowany.
- [ ] Zero sekretów w repo (tylko `.env.example` + Forgejo secrets).
- [ ] README: jak działa pipeline, jak rollbackować, jakie sekrety ustawić.
- [ ] Branch na origin + forgejo; merge lokalny → push do obu; brain-memory + Todoist zaktualizowane.
- [ ] **Po EPIC 5:** ręczny E2E na `savings.lan` (bootstrap, import CSV, CRUD, reload) — domyka zaległą acceptance EPIC 4.

## 7. Świadome NIE w EPIC 5

- Bez PWA (EPIC 6).
- Bez publicznego dostępu (Cloudflare Tunnel/Access) — to EPIC 6.2; teraz LAN-only przez nginx-proxy.
- Bez multi-env (staging) — single prod na CT111.
- Bez zaawansowanego monitoringu/alertów — wystarczy healthcheck compose + actuator.
