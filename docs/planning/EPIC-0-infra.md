# EPIC 0 — Infrastruktura krok po kroku (Proxmox + Debian LXC)

Runbook do postawienia infry pod savings-planner: storage z NATEC 1TB, dedykowany Postgres, Forgejo + runner, CT aplikacji. Wszystkie CT-y na **Debian 12 (bookworm)**, unprivileged LXC.

> Konwencja: `[HOST]` = komendy na Proxmox host (`192.168.100.150`), `[CTxxx]` = wewnątrz danego kontenera (`pct enter xxx`). Wartości do podmiany w `<...>`.

## Przydział VMID / IP (zatwierdzony)

| VMID | Hostname | IP | Rola | vCPU | RAM (cap) | Disk | Storage |
|---|---|---|---|---|---|---|---|
| 109 | db-finance | 192.168.100.164 | Postgres (finance) | 1 | 1 GB | 10 GB | natec |
| 110 | forgejo | 192.168.100.165 | Forgejo + Actions runner | 2 | 3 GB | 20 GB | natec |
| 111 | savings-app | 192.168.100.166 | frontend (nginx) + Kotlin/Spring Boot API | 2 | 2 GB | 12 GB | natec |

> ⚠️ CT108 / `.163` zostawiamy zarezerwowane pod `media-worker` z saves-pipeline. Dlatego startujemy od 109.
> DNS: AdGuard `192.168.100.151`. Reverse proxy (NPM): `192.168.100.153`.

---

## Chunk 0.0 — Commit zaległych zmian mortgage (na PC, nie homelab)

Zaakceptowane 2026-05-24 zmiany mortgage wiszą niezacommitowane — to one zapętlają hook checkpointu. Czyścimy to najpierw.

```bash
cd /e/repo/savings-planner          # Git Bash; albo E:\repo\savings-planner w PowerShell
git status                          # zobacz co wisi
npm test                           # 15 testów musi być zielone
git add -A
git commit -m "feat(mortgage): payoff planner (accepted 2026-05-24)"
```

Acceptance: `git status` czysty, testy zielone.

---

## Chunk 0.1 — NATEC 1TB jako pula storage Proxmox (LVM-thin)

LVM-thin = najlepsze pod LXC (snapshoty, thin provisioning). Pula współdzielona — finanse biorą mały wycinek, reszta zostaje dla innych projektów.

```bash
# [HOST] 1. Zidentyfikuj dysk NATEC (po rozmiarze ~1TB i braku partycji)
lsblk -o NAME,SIZE,TYPE,MODEL,MOUNTPOINT
# Załóżmy że to /dev/sdb — ZWERYFIKUJ zanim ruszysz dalej!

# [HOST] 2. Wyczyść stare sygnatury (DESTRUKCYJNE — pewność że to właściwy dysk)
wipefs -a /dev/sdb

# [HOST] 3. LVM: physical volume + volume group
pvcreate /dev/sdb
vgcreate natec-vg /dev/sdb

# [HOST] 4. Thin pool (95% miejsca, reszta na metadane)
lvcreate -l 95%FREE --thinpool natec-thin natec-vg

# [HOST] 5. Zarejestruj w Proxmox jako storage "natec"
pvesm add lvmthin natec --vgname natec-vg --thinpool natec-thin --content rootdir,images

# [HOST] 6. Weryfikacja
pvesm status            # "natec" widoczny, active
lvs natec-vg            # thin pool istnieje
```

Acceptance: `pvesm status` pokazuje `natec` jako active.
Po tym: **zaktualizuj `STATE/homelab.md`** — NATEC = pula współdzielona LVM-thin (nie media-only).

---

## Chunk 0.2 — CT 109 db-finance (Postgres)

### 0.2a Pobierz template Debian (jeśli brak)

```bash
# [HOST]
pveam update
pveam available --section system | grep debian-12
pveam download local debian-12-standard_12.7-1_amd64.tar.zst   # podmień na aktualną wersję z listy
```

### 0.2b Utwórz kontener

```bash
# [HOST]
pct create 109 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname db-finance \
  --cores 1 --memory 1024 --swap 512 \
  --rootfs natec:10 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.100.164/24,gw=192.168.100.1 \
  --nameserver 192.168.100.151 \
  --unprivileged 1 --onboot 1 \
  --password

pct start 109
pct enter 109
```

### 0.2c Wewnątrz: Postgres

```bash
# [CT109]
apt update && apt -y upgrade
apt -y install postgresql postgresql-contrib   # Debian 12 = PG15 (wystarczy)

# nasłuch na LAN
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf

# dostęp tylko z CT aplikacji (.166), scram
echo "host    finance    app_user    192.168.100.166/32    scram-sha-256" >> /etc/postgresql/15/main/pg_hba.conf

systemctl restart postgresql

# rola + baza
sudo -u postgres psql -c "CREATE ROLE app_user LOGIN PASSWORD '<SILNE_HASLO>';"
sudo -u postgres psql -c "CREATE DATABASE finance OWNER app_user;"
sudo -u postgres psql -d finance -c "GRANT ALL ON SCHEMA public TO app_user;"
```

### 0.2d Backup (pg_dump cron + retencja 14 dni)

```bash
# [CT109]
mkdir -p /var/backups/finance
cat > /etc/cron.d/finance-backup <<'EOF'
0 3 * * * postgres pg_dump finance | gzip > /var/backups/finance/finance-$(date +\%F).sql.gz
5 3 * * * root find /var/backups/finance -name '*.sql.gz' -mtime +14 -delete
EOF
```

Acceptance: z CT111 `psql -h 192.168.100.164 -U app_user -d finance` łączy się; testowy `pg_dump` tworzy plik.

---

## Chunk 0.3 — CT 110 Forgejo + Actions runner

### 0.3a Utwórz kontener (z nesting+keyctl pod Dockera)

```bash
# [HOST]
pct create 110 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname forgejo \
  --cores 2 --memory 3072 --swap 1024 \
  --rootfs natec:20 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.100.165/24,gw=192.168.100.1 \
  --nameserver 192.168.100.151 \
  --unprivileged 1 --onboot 1 \
  --features nesting=1,keyctl=1 \
  --password

pct start 110
pct enter 110
```

### 0.3b Docker

```bash
# [CT110]
apt update && apt -y install ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 0.3c Forgejo (compose)

```bash
# [CT110]
mkdir -p /opt/forgejo && cd /opt/forgejo
cat > docker-compose.yml <<'EOF'
services:
  forgejo:
    image: codeberg.org/forgejo/forgejo:9
    container_name: forgejo
    restart: unless-stopped
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - FORGEJO__server__ROOT_URL=http://192.168.100.165:3000/
    volumes:
      - ./data:/data
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "3000:3000"
      - "2222:22"
EOF
docker compose up -d
```

Wejdź na `http://192.168.100.165:3000`, dokończ instalator (SQLite wystarczy single-user), załóż konto admin, utwórz repo `savings-planner` i wypchnij kod z PC:

```bash
# [PC]
cd /e/repo/savings-planner
git remote add forgejo http://192.168.100.165:3000/<user>/savings-planner.git
git push forgejo main
```

### 0.3d Actions runner

W Forgejo: **Site Administration → Actions → Runners → Create new runner** → skopiuj `TOKEN`. Następnie:

```bash
# [CT110]
cd /opt/forgejo
cat >> docker-compose.yml <<'EOF'

  runner:
    image: code.forgejo.org/forgejo/runner:6
    container_name: forgejo-runner
    restart: unless-stopped
    depends_on: [forgejo]
    volumes:
      - ./runner:/data
      - /var/run/docker.sock:/var/run/docker.sock   # runner buduje obrazy na hoście CT
    command: forgejo-runner daemon
EOF

# rejestracja (jednorazowo)
docker run --rm -v /opt/forgejo/runner:/data \
  code.forgejo.org/forgejo/runner:6 \
  forgejo-runner register --no-interactive \
    --instance http://192.168.100.165:3000 \
    --token <TOKEN> \
    --name homelab-runner \
    --labels docker:docker://node:20-bookworm,host:host

docker compose up -d runner
```

Acceptance: w Forgejo → Runners runner ma status **online**; commit z prostym `.forgejo/workflows/ci.yml` (np. `echo hello`) zielono się wykonuje.

---

## Chunk 0.4 — CT 111 savings-app + reverse proxy + DNS

### 0.4a Utwórz kontener

```bash
# [HOST]
pct create 111 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname savings-app \
  --cores 2 --memory 2048 --swap 1024 \
  --rootfs natec:12 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.100.166/24,gw=192.168.100.1 \
  --nameserver 192.168.100.151 \
  --unprivileged 1 --onboot 1 \
  --features nesting=1,keyctl=1 \
  --password

pct start 111
pct enter 111
```

### 0.4b Docker (jak w 0.3b) + placeholder

```bash
# [CT111] — zainstaluj Docker tak jak w kroku 0.3b, potem:
docker run -d --name placeholder --restart unless-stopped -p 80:80 nginx:alpine
```

### 0.4c Reverse proxy (NPM na CT103) + DNS (AdGuard na CT101)

1. **AdGuard** (`http://192.168.100.151`) → Filters → DNS rewrites → dodaj:
   `savings.lan` → `192.168.100.153` (IP nginx-proxy/NPM).
2. **NPM** (`http://192.168.100.153`) → Proxy Hosts → Add:
   - Domain: `savings.lan`
   - Forward Hostname/IP: `192.168.100.166`, Port: `80`
   - (Block Common Exploits ON; HTTPS opcjonalnie self-signed dla LAN).

Acceptance: `http://savings.lan` z dowolnego urządzenia w LAN serwuje placeholder nginx.

---

## Kolejność i zależności EPIC 0

```
0.0 (PC, niezależne)
0.1 ──┬─→ 0.2 (db-finance)
      ├─→ 0.4 (app)      ← potrzebuje storage natec
0.3 (forgejo) — niezależne od 0.1 (może iść równolegle, ale też na natec → po 0.1)
```

Po EPIC 0: storage gotowy, baza stoi, Forgejo z runnerem działa, apka ma dom pod `savings.lan`. Dalej → EPIC 3 (backend) i EPIC 5 (CI/CD pipeline w `.forgejo/workflows/`).

---

## Budżet zasobów po EPIC 0

Patrz `STATE/homelab.md` sekcja „Budżet zasobów". Skrót: RAM to wąskie gardło — po dołożeniu tych 3 CT-ów rezerwa robi się cienka (~0 GB na capach, ale LXC nie rezerwuje RAM z góry, więc realnie OK dopóki Gradle/JVM nie zaszaleją równocześnie). Spike ryzyka = build Gradle na runnerze + JVM backendu naraz. Mitygacja: `org.gradle.workers.max` niski, albo docelowo +RAM do Optiplexa.
