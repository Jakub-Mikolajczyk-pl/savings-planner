# EPIC 5 — manual setup checklist

Rzeczy, których nie da się bezpiecznie zrobić z repo: ustawienie sekretów, SSH, registry login i pierwsze uruchomienie na CT111. Placeholdery `<...>` podmień lokalnie. Sekretów nie zapisuj w git.

## 1. Forgejo runner / CT110

W Forgejo sprawdź, że runner ma label `host` i że job hostowy ma dostęp do narzędzi:

```bash
# [CT110]
node --version
npm --version
java -version
docker version
ssh -V
```

Jeśli czegoś brakuje:

```bash
# [CT110]
apt update
apt install -y nodejs npm openjdk-21-jdk docker-ce-cli openssh-client
```

Jeśli CI backendu nie widzi Dockera/Testcontainers:

```bash
# [CT110]
ls -l /var/run/docker.sock
docker ps
```

Runner musi mieć `/var/run/docker.sock` zamontowany tak jak w EPIC-0 runbooku.

## 2. Secrets w Forgejo

Repo `savings-planner` → Settings → Actions → Secrets:

| Secret | Wartość |
|---|---|
| `REGISTRY_USER` | użytkownik Forgejo, np. `jakub` |
| `REGISTRY_TOKEN` | token Forgejo z prawem do packages/registry |
| `CT111_SSH_KEY` | prywatny klucz SSH do użytkownika `deploy` na CT111 |

Sekrety bazy i API nie muszą iść do Actions, jeśli `.env` żyje tylko na CT111.

### Skąd wziąć `REGISTRY_TOKEN`

To token wygenerowany w Forgejo, nie hasło do konta.

1. Forgejo → avatar/profil użytkownika `jakub` → Settings → Applications / Access Tokens.
2. Wygeneruj token np. `savings-planner-registry`.
3. Daj mu minimalne scope do registry/packages:
   - push obrazów z CI: package/registry read + write,
   - jeśli repo jest prywatne i Forgejo tego wymaga w Twojej wersji UI: również read repo.
4. Wartość tokena wklej jako Forgejo Actions secret `REGISTRY_TOKEN`.

Ten sam token możesz podać przy `docker login` na CT111, ale czyściej jest zrobić drugi token read-only, np. `savings-planner-ct111-pull`, tylko do pullowania obrazów.

### Skąd wziąć `CT111_SSH_KEY`

To prywatna część pary kluczy SSH, którą sam generujesz dla deployu. Nie bierze się jej z Proxmoxa.

Na swoim PC albo na CT110:

```bash
ssh-keygen -t ed25519 -C "savings-planner deploy to CT111" -f ./savings-planner-ct111-deploy
```

Powstaną dwa pliki:

- `savings-planner-ct111-deploy` — prywatny klucz, wklejasz do Forgejo secret `CT111_SSH_KEY`,
- `savings-planner-ct111-deploy.pub` — publiczny klucz, wklejasz na CT111 do `/home/deploy/.ssh/authorized_keys`.

Po wklejeniu prywatnego klucza do Forgejo usuń lokalny plik prywatny albo trzymaj go w bezpiecznym miejscu poza repo. Nigdy nie commituj kluczy SSH.

## 3. Użytkownik deploy na CT111

```bash
# [CT111]
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
mkdir -p /opt/savings-planner
chown -R deploy:deploy /opt/savings-planner
```

Wklej publiczny klucz pasujący do `CT111_SSH_KEY`.

Z CT110 przetestuj:

```bash
# [CT110]
ssh deploy@192.168.100.166 "docker ps"
```

## 4. Registry login na CT111

Zaloguj CT111 do Forgejo registry, żeby `docker compose pull` działał bez przekazywania tokena w deploy jobie:

```bash
# [CT111]
su - deploy
docker login 192.168.100.165:3000 -u jakub
```

Podaj token registry z Forgejo.

## 5. Produkcyjny `.env` na CT111

```bash
# [CT111]
su - deploy
mkdir -p /opt/savings-planner
nano /opt/savings-planner/.env
chmod 600 /opt/savings-planner/.env
```

Minimalna zawartość:

```bash
IMAGE_REGISTRY=192.168.100.165:3000/jakub
IMAGE_TAG=latest
DB_HOST=192.168.100.164
DB_PORT=5432
DB_NAME=finance
DB_USER=app_user
DB_PASSWORD=<HASLO_Z_CT109>
API_TOKEN=<DLUGI_LOSOWY_TOKEN>
CORS_ALLOWED_ORIGINS=http://savings.lan
```

Ten sam `API_TOKEN` musi być ustawiony dla backendu i frontowego nginx proxy. Przeglądarka go nie zna; nginx nadpisuje nagłówek `X-Api-Token` przy `/api/**`.

### Skąd wziąć `API_TOKEN`

To losowy sekret aplikacji, który sam generujesz. Nie pochodzi z Forgejo ani z Proxmoxa. Backend wymaga go na `/api/**`, a nginx w kontenerze frontendowym dokłada go automatycznie.

Na Windows PowerShell:

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Albo na LXC/Linux:

```bash
openssl rand -hex 32
```

Wynik wklej jako `API_TOKEN=...` do `/opt/savings-planner/.env` na CT111. Nie ustawiaj tego tokena jako `VITE_API_TOKEN` w produkcji, bo zmienne `VITE_*` trafiają do bundle przeglądarki.

## 6. Pierwszy deploy ręczny

Po pierwszym zielonym `Deploy` workflow compose plik powinien już być skopiowany na CT111. Jeśli chcesz odpalić ręcznie:

```bash
# [CT111]
su - deploy
cd /opt/savings-planner
IMAGE_TAG=<SHA_Z_WORKFLOW> docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=<SHA_Z_WORKFLOW> docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100
```

Sprawdź:

```bash
curl -i http://localhost/
curl -i http://localhost/api/accounts
docker compose -f docker-compose.prod.yml exec backend curl -fsS http://localhost:8080/actuator/health
```

`/api/accounts` powinno przejść przez nginx i dostać token automatycznie.

## 7. Reverse proxy i DNS

Powinno już istnieć po EPIC 0, ale sprawdź:

- AdGuard: `savings.lan` → `192.168.100.153`
- NPM/CT103: `savings.lan` → `192.168.100.166:80`
- Z laptopa: `http://savings.lan`

## 8. Rollback

Na CT111:

```bash
# [CT111]
su - deploy
cd /opt/savings-planner
IMAGE_TAG=<POPRZEDNI_SHA> docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=<POPRZEDNI_SHA> docker compose -f docker-compose.prod.yml up -d
```

Tagi SHA zobaczysz w Forgejo Packages albo w logach workflow `Deploy`.
