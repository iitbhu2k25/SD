# Post-Deployment Solutions Guide
### Detailed, actionable fixes for every issue found in the current WaterDSS codebase.

**Stack:** Next.js 16 · Django 5.1 + Daphne · FastAPI + Gunicorn/Uvicorn · FastM + Uvicorn · PostgreSQL 16 · Redis 7.4 · Celery 5.4 · GeoServer 2.28.0 (Kartoza) · Docker Compose · Cloudflare Tunnel · Vercel

**Date:** May 2026 · Version 2.0 · Verified against current source code

---

## Table of Contents

| # | Issue | Priority |
|---|-------|----------|
| 01 | Hardcoded Secrets in Source Code | **CRITICAL** |
| 02 | No Health Checks on Any Docker Service | **HIGH** |
| 03 | GeoServer CORS Partially Fixed — WebSocket URL Still Wrong | **CRITICAL** |
| 04 | No Database Backup Strategy | **HIGH** |
| 05 | PostGIS Spatial Queries Missing Indexes | **HIGH** |
| 06 | Celery Flower Has No Authentication | **MEDIUM** |
| 07 | Access Token Expiry Set to 1 Minute | **HIGH** |
| 08 | print() Statements in Production Settings + Logs Lost on Restart | **MEDIUM** |
| 09 | DB and Redis Ports Still Exposed Publicly | **HIGH** |
| 10 | No CI/CD Pipeline | **MEDIUM** |
| 11 | Rate Limiting Missing on Django Backend | **MEDIUM** |
| 12 | Three Separate Databases, Alembic Not Run on Startup | **MEDIUM** |
| 13 | FastAPI CORS Allows All Methods and Headers | **MEDIUM** |
| 14 | Frontend env.txt Has Wrong WebSocket URL and Exposed Secret | **CRITICAL** |
| 15 | proxy.ts Does Not Validate Token Expiry | **MEDIUM** |
| ·· | Priority Checklist | |

---

## ISSUE 01 — Hardcoded Secrets in Source Code `CRITICAL`

### What's happening

Multiple credentials are hardcoded directly in tracked source files. Any access to the repository — by a contributor, a compromised CI runner, or a public leak — immediately exposes every service.

### Exact locations in your current codebase

| File | Line | Secret |
|------|------|--------|
| `backend/main/settings.py` | 12 | `SECRET_KEY = "django-insecure-3v41%..."` |
| `backend/main/settings.py` | 243–244 | Gmail address + app password in plain text |
| `fast_backend/fastdb.txt` | 6–7 | `SECRET_KEY`, `VERIFY_KEY` (JWT signing keys) |
| `fast_backend/fastdb.txt` | 15–16 | `MAIL_PASSWORD = "sbkd vdki erqz morb"` |
| `fast_backend/fastdb.txt` | 1–2 | `POSTGRES_USER=admin`, `POSTGRES_PASSWORD=admin` |
| `fast_backend/fastdb.txt` | 19–28 | GeoServer credentials (`admin/geoserver`) |
| `database/.db.env` | 1–2 | `POSTGRES_USER=admin`, `POSTGRES_PASSWORD=admin` |
| `frontend/env.txt` | 5 | `NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/...` — sent to every browser |

### Solutions

**1 — Move Django SECRET_KEY and email credentials to environment variables**

```python
# backend/main/settings.py
import os

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]        # remove the hardcoded string
EMAIL_HOST_USER = os.environ["EMAIL_HOST_USER"]
EMAIL_HOST_PASSWORD = os.environ["EMAIL_HOST_PASSWORD"]
```

Add these to your `.env` file (never commit real values):
```
DJANGO_SECRET_KEY=<generate-with-command-below>
EMAIL_HOST_USER=ak2968028@gmail.com
EMAIL_HOST_PASSWORD=<rotated-app-password>
```

**2 — Rename fastdb.txt to .fastdb.env and add it to .gitignore**

Your `docker-compose.yml` already references `./fast_backend/.fastdb.env`. The file is currently named `fastdb.txt`, making it easy to accidentally commit. Rename it and add both names to `.gitignore`:

```bash
mv fast_backend/fastdb.txt fast_backend/.fastdb.env
echo "fast_backend/.fastdb.env" >> .gitignore
echo "fast_backend/fastdb.txt" >> .gitignore
echo "database/.db.env" >> .gitignore
echo ".env" >> .gitignore
echo "frontend/.env" >> .gitignore
```

**3 — Remove NEXT_PUBLIC_SECRET from the frontend**

`NEXT_PUBLIC_` variables are baked into the JavaScript bundle shipped to every browser. The JWT signing key must never be there. Token verification already runs server-side in `proxy.ts` — move the key there:

```typescript
// frontend/proxy.ts — use process.env.MY_VERIFY_KEY (server-only, no NEXT_PUBLIC_ prefix)
// Remove NEXT_PUBLIC_SECRET from env.txt entirely
// MY_VERIFY_KEY is already in env.txt line 6 — use only that
```

**4 — Rotate all currently exposed credentials immediately**

```bash
# New Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# New FastAPI JWT secret
openssl rand -base64 32

# Then:
# - Revoke the Gmail App Password (ak2968028@gmail.com) — generate a new one
# - Revoke the dssiitbhu@gmail.com App Password — generate a new one
# - Change GeoServer password from 'geoserver' to something strong
# - Change PostgreSQL password from 'admin' — update database/.db.env
# - Change Redis password from 'your_secure_password' to a real generated secret
```

**5 — Keep .env.example files with placeholder values only**

```
# fast_backend/.env.example
POSTGRES_USER=changeme
POSTGRES_PASSWORD=changeme
SECRET_KEY=changeme-generate-with-openssl-rand-base64-32
VERIFY_KEY=changeme
ACCESS_TOKEN_EXPIRE_MINUTES=60
MAIL_PASSWORD=changeme-use-gmail-app-password
GEOSERVER_ADMIN_PASSWORD=changeme
REDIS_PASSWORD=changeme
```

---

## ISSUE 02 — No Health Checks on Any Docker Service `HIGH`

### What's happening

Your `docker-compose.yml` has `depends_on` for all services, but `depends_on` only waits for the container process to start — not for the service inside to be ready. PostgreSQL takes several seconds before accepting connections. Your Django backend runs `python manage.py migrate` immediately on startup and fails with a connection error. Celery workers (`celery_low`, `celery_high`, `celery_django`) all start before Redis is ready. `restart: always` masks this — services simply crash-restart until the dependency is up, creating log noise and slow startup. **No service currently defines a `healthcheck`.**

### Specific locations in your codebase

- `docker-compose.yml` — zero `healthcheck` blocks on any of the 11 services
- `backend` service — runs `python manage.py migrate` with no wait logic
- `celery_low`, `celery_high` — depend on `redis` but no health condition
- `celery_django` — depends on `redis_django` and `backend` but no health condition
- `database` service — `depends_on: [redis, geoserver]` (unusual — DB should not depend on GeoServer)

### Solutions

**1 — Add healthchecks to all infrastructure services**

```yaml
# docker-compose.yml

database:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U admin -d slcr_cloud"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s

redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5

redis_django:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5

geoserver:
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:8080/geoserver/web/ || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s
```

**2 — Use `condition: service_healthy` on dependent services**

```yaml
backend:
  depends_on:
    database:
      condition: service_healthy
    redis_django:
      condition: service_healthy

fast_backend:
  depends_on:
    database:
      condition: service_healthy
    redis:
      condition: service_healthy

celery_low:
  depends_on:
    redis:
      condition: service_healthy
    fast_backend:
      condition: service_started

celery_high:
  depends_on:
    redis:
      condition: service_healthy

celery_django:
  depends_on:
    redis_django:
      condition: service_healthy
    backend:
      condition: service_started

flower:
  depends_on:
    redis:
      condition: service_healthy
```

**3 — Fix the database depends_on (it should not depend on GeoServer)**

```yaml
# Current (wrong):
database:
  depends_on:
    - redis
    - geoserver

# Fixed:
database:
  # No depends_on — database has no upstream dependencies
```

**4 — Add /health endpoints to FastAPI and Django**

```python
# fast_backend/app/main.py — add before include_router calls
@app.get("/health")
async def health():
    return {"status": "ok"}
```

```python
# backend/main/urls.py
from django.http import JsonResponse
urlpatterns += [path("health/", lambda r: JsonResponse({"status": "ok"}))]
```

---

## ISSUE 03 — GeoServer CORS Partially Fixed — WebSocket URL Still Wrong `CRITICAL`

### What's happening

Your `docker-compose.yml` now sets GeoServer CORS to include wildcard subdomains:
```
CORS_ALLOWED_ORIGINS: http://localhost:3000,https://*.slcrdss.in,https://*.slcrdss.xyz
```
This is better than the original `localhost:3000` only, but two problems remain:

1. **GeoServer does not support wildcard subdomains** in its CORS filter the same way browsers do. You must list exact origins.
2. **`frontend/env.txt` line 7**: `NEXT_PUBLIC_WEBSOCKET_URL = wss://fast_backend:7000/api` — this uses the Docker internal service name (`fast_backend`) which resolves only inside the Docker network, not from the browser. Every WebSocket connection from users fails.

### Specific locations in your codebase

- `docker-compose.yml` line 195: wildcard `https://*.slcrdss.in` in GeoServer CORS
- `frontend/env.txt` line 7: `wss://fast_backend:7000/api` — Docker hostname, unreachable from browser
- `frontend/env.txt` line 13: `ws://localhost:9000/django` — plain `ws://` rejected by Cloudflare Tunnel

### Solutions

**1 — Replace wildcard with exact origins in GeoServer CORS**

```yaml
geoserver:
  environment:
    CORS_ALLOWED_ORIGINS: "https://slcrdss.in,https://www.slcrdss.in,http://localhost:3000"
    CORS_ALLOWED_METHODS: "GET,POST,PUT,DELETE,HEAD,OPTIONS"
    CORS_ALLOWED_HEADERS: "*"
```

**2 — Fix the WebSocket URLs in frontend/env.txt**

```
# frontend/env.txt — corrected values

# WebSocket must use your public Cloudflare Tunnel domain, not the Docker service name
NEXT_PUBLIC_WEBSOCKET_URL = wss://slcrdss.in/api/ws

# Django WebSocket — must be wss:// not ws:// through Cloudflare
NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = wss://slcrdss.in/django/ws
```

**3 — Note: next.config.ts already proxies GeoServer correctly**

Your `next.config.ts` has:
```typescript
{ source: '/geoserver/:path*', destination: 'http://geoserver:8080/geoserver/:path*' }
```
And `frontend/env.txt` already uses `NEXT_PUBLIC_GEOSERVER_URL = /geoserver` (relative path through Next.js proxy). This is the correct pattern. Keep it — GeoServer CORS does not need to include Vercel's domain because GeoServer is never called directly from the browser in this setup.

**4 — Verify CORS middleware order in FastAPI**

Your `fast_backend/app/main.py` adds `CORSMiddleware` before `RateLimiterMiddleware`. This is correct — CORS must run before any middleware that returns 4xx, otherwise preflight OPTIONS requests get rejected with 429/401 before CORS headers are added.

---

## ISSUE 04 — No Database Backup Strategy `HIGH`

### What's happening

Your PostgreSQL data lives in the `postgres_data` Docker named volume. GeoServer config lives in `geoserver_data`. Both Redis volumes (`redis_data`, `redis_django_data`) hold Celery task history and Django session data. There are no backup jobs, no cron scripts, and no off-machine copies. A single `docker compose down -v` or host disk failure means permanent loss of all user accounts, spatial analysis results, and GeoServer layer configurations.

### Specific locations in your codebase

- `docker-compose.yml` volumes: `postgres_data`, `geoserver_data`, `redis_data`, `redis_django_data` — no backup
- `del.sh` — **this script deletes ALL Docker volumes with no confirmation prompt.** Running it by accident destroys all data permanently.

### Solutions

**1 — Add a safety check to del.sh immediately**

```bash
#!/bin/bash
# del.sh — add confirmation before destroying everything
echo "WARNING: This will delete ALL Docker containers, images, and volumes."
echo "Type 'YES' to confirm:"
read confirm
if [ "$confirm" != "YES" ]; then
  echo "Aborted."
  exit 1
fi
docker ps -q | xargs -r docker stop
# ... rest of script
```

**2 — Set up automated daily pg_dump for all three databases**

Create `/opt/waterdss/backup.sh` on the host machine:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/waterdss/backups"
mkdir -p $BACKUP_DIR

# Dump all three databases
for DB in slcr slcr_cloud slcr_fastm; do
  docker exec slcrdeployment-database-1 pg_dump -U admin $DB \
    | gzip > "$BACKUP_DIR/${DB}_${DATE}.sql.gz"
done

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Schedule with cron: 0 2 * * * /opt/waterdss/backup.sh
```

**3 — Back up GeoServer data directory**

```bash
docker run --rm \
  -v geoserver_data:/data \
  -v /opt/waterdss/backups:/backup \
  ubuntu tar czf /backup/geoserver_${DATE}.tar.gz /data
```

**4 — Upload backups off-machine**

```bash
rclone copy /opt/waterdss/backups/ r2:waterdss-backups/
```

**5 — Test your restore process now, not during a crisis**

Restore to a test database and verify row counts and that a login works. Document the commands. Know your Recovery Time Objective before you need it under pressure.

---

## ISSUE 05 — PostGIS Spatial Queries Missing Indexes `HIGH`

### What's happening

Your spatial operations (STP site suitability, watershed delineation, GWZ queries) operate on PostGIS tables defined in `model_gwz.py` and `model_stp.py`. None of the SQLAlchemy model definitions include spatial indexes. Without GiST indexes, every query using `ST_Within`, `ST_Intersects`, `ST_Distance`, or `ST_DWithin` performs a full table scan. With India-wide datasets, a query taking 20 ms in development with 1,000 rows will take 30+ seconds in production with 2 million rows.

### Specific locations in your codebase

- `fast_backend/app/database/models/model_gwz.py` — `water_quality_assessment` table, `groundwater_zone_raster` tables — all have geometry/coordinate columns, no indexes
- `fast_backend/app/database/models/model_stp.py` — `stp_towns` (lat/lon), `stp_drain` (coordinates), `stp_catchment` — no spatial indexes
- No Alembic migration creates any GiST index

### Solutions

**1 — Add GiST indexes via a new Alembic migration**

```python
# In a new Alembic migration file
def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS idx_stp_towns_geom ON stp_towns USING GIST (ST_Point(longitude, latitude))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_gwz_water_quality ON water_quality_assessment USING GIST (geometry)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stp_drain_geom ON stp_drain USING GIST (geometry)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stp_catchment_geom ON stp_catchment USING GIST (geometry)")
```

**2 — Find all geometry columns missing indexes right now**

```sql
-- Run in psql against slcr_cloud
SELECT f_table_name, f_geometry_column
FROM geometry_columns
WHERE f_table_name NOT IN (
    SELECT tablename FROM pg_indexes WHERE indexdef LIKE '%gist%'
);
```

**3 — Use EXPLAIN ANALYZE on slow queries**

Look for `Seq Scan` — that means no index is used. After adding GiST indexes you should see `Index Scan using idx_...`.

```sql
EXPLAIN ANALYZE
SELECT * FROM stp_drain
WHERE ST_Within(geometry, ST_MakeEnvelope(80.5, 24.5, 83.5, 26.5, 4326));
```

**4 — Fix N+1 query pattern in SQLAlchemy**

```python
from sqlalchemy.orm import selectinload

result = await db.execute(
    select(STP_drain).options(selectinload(STP_drain.related_data))
)
# Use SQLALCHEMY_ECHO=True temporarily to log all queries and find N+1 patterns
```

---

## ISSUE 06 — Celery Flower Has No Authentication `MEDIUM`

### What's happening

Your `flower` service is running at port 5555 with:
```yaml
command: celery --broker=redis://redis:6379/0 flower --port=5555
```
There is no `--basic_auth` flag. Anyone who can reach port 5555 can see all Celery task history, worker status, queue depths, task arguments (which may contain user data), and can revoke or retry tasks.

### Specific locations in your codebase

- `docker-compose.yml` lines 175–183: `flower` with no authentication
- Port `5555` mapped publicly

### Solutions

**1 — Add basic auth to Flower**

```yaml
flower:
  image: mher/flower:latest
  ports:
    - "5555:5555"
  depends_on:
    redis:
      condition: service_healthy
  command: >
    celery --broker=redis://redis:6379/0 flower
    --port=5555
    --basic_auth=${FLOWER_USER}:${FLOWER_PASSWORD}
```

Add to your environment file:
```
FLOWER_USER=admin
FLOWER_PASSWORD=<generate-strong-password>
```

**2 — Celery configuration is already well-configured — keep these settings**

Your `fast_backend/app/conf/celery.py` already has the correct production settings:
- `worker_max_tasks_per_child=50` — prevents memory growth from heavy geospatial operations ✓
- `result_expires=3600` — Redis memory does not grow indefinitely ✓
- `task_soft_time_limit=600`, `task_time_limit=650` — tasks are bounded ✓
- `task_acks_late=True`, `task_reject_on_worker_lost=True` — no silent task loss ✓
- `broker_heartbeat=30` — connection health maintained ✓

**3 — Add Redis health dependency to celery workers**

Currently `celery_low` and `celery_high` list `redis` in `depends_on` but without `condition: service_healthy`. A worker that starts before Redis is ready will crash and restart. Fix with the health check approach from Issue 02.

---

## ISSUE 07 — Access Token Expiry Set to 1 Minute `HIGH`

### What's happening

`fast_backend/fastdb.txt` line 9: `ACCESS_TOKEN_EXPIRE_MINUTES = 1`

Every user's FastAPI access token expires in 60 seconds. A user running STP site suitability analysis, watershed delineation, or GWZ queries (Celery tasks that take 2–30 minutes) will have their token expire mid-operation. If the frontend does not handle 401 responses by silently refreshing the token, the request fails and the user appears logged out during active work.

Additionally, `REFRESH_TOKEN_EXPIRE_DAYS = 1` means users are fully logged out daily.

### Specific locations in your codebase

- `fast_backend/fastdb.txt` line 9: `ACCESS_TOKEN_EXPIRE_MINUTES = 1`
- `fast_backend/fastdb.txt` line 10: `REFRESH_TOKEN_EXPIRE_DAYS = 1`

### Solutions

**1 — Increase to practical values**

```
# fast_backend/.fastdb.env
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
```

**2 — Implement silent token refresh in Axios**

```typescript
// Add to your Axios instance configuration
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await refreshToken();  // call your /token/refresh endpoint
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);
```

**3 — Handle token expiry in Django WebSocket connections**

Your Django WebSocket uses `TokenAuthenticationMiddleware` (`channels_redis` on `redis_django:6379`). WebSocket connections that outlive the token will be silently dropped. Implement reconnection logic in your `reconnecting-websocket` setup that fetches a fresh token on each reconnect attempt.

---

## ISSUE 08 — print() Statements in Production Settings + Logs Lost on Restart `MEDIUM`

### What's happening

**Problem A — print() statements in settings.py:**
`backend/main/settings.py` lines 200–202:
```python
print("CELERY_BROKER_URL", CELERY_BROKER_URL)
print("CELERY_RESULT_BACKEND", CELERY_RESULT_BACKEND)
print("CACHE_URL", CACHE_URL)
```
These print the Redis connection URLs (including any embedded credentials) to stdout on every Django startup. In Docker, stdout goes to the container log, which may be collected and stored by log aggregators.

**Problem B — FastAPI logs lost on restart:**
`fast_backend/app/conf/logging.py` writes to `logs/app.log` and `logs/errors.log` relative to the working directory inside the container. When the container restarts, these log files are lost. The logging configuration is good (rotating file handlers, structured format, error separation) but is writing to ephemeral container storage.

### Specific locations in your codebase

- `backend/main/settings.py` lines 200–202: three `print()` calls
- `fast_backend/app/conf/logging.py`: `LOG_FILE = "logs/app.log"` — relative path, ephemeral

### Solutions

**1 — Remove print() statements from settings.py**

```python
# backend/main/settings.py — remove lines 200-202 entirely
# Replace with proper logging if needed:
import logging
logger = logging.getLogger(__name__)
logger.debug("CELERY_BROKER_URL loaded: %s", bool(CELERY_BROKER_URL))
```

**2 — Mount log directories as Docker volumes**

```yaml
# docker-compose.yml
fast_backend:
  volumes:
    - ./fast_backend:/home/app:z
    - ./logs/fast_backend:/home/app/logs    # add this line

backend:
  volumes:
    - ./backend:/home/app:z
    - ./logs/backend:/home/app/logs         # add this line

celery_low:
  volumes:
    - ./fast_backend:/home/app:z
    - ./logs/celery_low:/home/app/logs      # add this line

celery_high:
  volumes:
    - ./fast_backend:/home/app:z
    - ./logs/celery_high:/home/app/logs     # add this line
```

**3 — Add structured logging to Django**

```python
# backend/main/settings.py — add LOGGING configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        }
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/home/app/logs/django.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "standard",
        },
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["file", "console"], "level": "INFO"},
}
```

**4 — sentry-sdk is already available — wire it up**

```python
# backend/main/settings.py
import sentry_sdk
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    traces_sample_rate=0.1,
)

# fast_backend/app/main.py
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
sentry_sdk.init(dsn=os.environ.get("SENTRY_DSN"), traces_sample_rate=0.1)
app.add_middleware(SentryAsgiMiddleware)
```

---

## ISSUE 09 — Database and Redis Ports Still Exposed Publicly `HIGH`

### What's happening

Your `docker-compose.yml` maps these ports to the host:

| Service | Host Port | Risk |
|---------|-----------|------|
| `database` | `5450:5432` | PostgreSQL directly reachable from the internet |
| `redis` | `6379:6379` | Redis directly reachable from the internet |
| `redis_django` | `6370:6379` | Redis directly reachable from the internet |

Anyone who reaches your host IP on port 5450 can attempt direct PostgreSQL connections with `admin/admin`. Anyone on 6379 can attempt Redis commands (including `FLUSHALL`). There is also no Nginx reverse proxy — all five application services (frontend 3000, backend 9000, fast_backend 7000, fast_m 7100, flower 5555) are individually exposed, with no single entry point.

### Specific locations in your codebase

- `docker-compose.yml` line 17: `database` ports `5450:5432`
- `docker-compose.yml` line 49: `redis_django` ports `6370:6379` (partially mitigated by `expose:`)
- `docker-compose.yml` line 121: `redis` ports `6379:6379`

### Solutions

**1 — Remove database and Redis ports from public host binding immediately**

```yaml
database:
  # Remove the ports: block entirely — use expose: for intra-Docker access only
  expose:
    - "5432"

redis:
  # Remove ports: 6379:6379
  expose:
    - "6379"

redis_django:
  # Already has expose: — remove the ports: block if present
  expose:
    - "6379"
```

**2 — Add Nginx as a single entry point**

Create `nginx/nginx.conf`:

```nginx
upstream django    { server backend:9000; }
upstream fastapi   { server fast_backend:7000; }
upstream fastm     { server fast_m:7100; }
upstream geoserver { server geoserver:8080; }

server {
    listen 80;
    server_name slcrdss.in;

    location /django/    { proxy_pass http://django/django/; }
    location /api/       { proxy_pass http://fastapi/api/; }
    location /fastapi/   { proxy_pass http://fastm/; }
    location /geoserver/ { proxy_pass http://geoserver/geoserver/; }

    # WebSocket support for Django Channels
    location /django/ws/ {
        proxy_pass http://django/django/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # WebSocket support for FastAPI
    location /api/ws/ {
        proxy_pass http://fastapi/api/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 100M;  # for shapefile uploads
}
```

Add to `docker-compose.yml`:

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - backend
    - fast_backend
    - fast_m
  restart: always
```

**3 — Point Cloudflare Tunnel to Nginx**

Configure `cloudflared` to forward to `http://localhost:80` (Nginx), not to individual service ports. This gives you one entry point with routing, access logging, and rate limiting.

---

## ISSUE 10 — No CI/CD Pipeline `MEDIUM`

### What's happening

There is no `.github/workflows/` directory in the repository. Every deployment is manual: SSH into the machine, `git pull`, `docker compose build`, `docker compose up -d`. There is no automated test run, no build validation, and no smoke test after deploy. `del.sh` only destroys containers and has no build or deploy logic.

### Solutions

**1 — Create a minimal GitHub Actions deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy WaterDSS

on:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Django deps
        run: pip install -r backend/requirements.txt

      - name: Django system check
        env:
          DJANGO_SECRET_KEY: test-key
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_HOST: localhost
          POSTGRES_PORT: 5432
        run: cd backend && python manage.py check --deploy

  deploy:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/waterdss
            git pull
            docker compose build
            docker compose up -d
            docker compose exec fast_backend alembic upgrade head
```

**2 — Tag every production deployment**

```bash
git tag v1.0.$(date +%Y%m%d) && git push --tags
```

**3 — Build a one-command rollback**

```bash
# Before deploying new version
docker tag backend_fast:latest backend_fast:previous
docker tag backend:latest backend:previous

# Rollback
docker tag backend_fast:previous backend_fast:latest
docker compose up -d fast_backend
```

---

## ISSUE 11 — Rate Limiting Missing on Django Backend `MEDIUM`

### What's happening

Your FastAPI has a custom `AsyncSlidingWindowCounter` rate limiting middleware (`fast_backend/app/conf/rate_limiting.py`). However this is an in-process counter — it does not share state across Gunicorn workers, so each worker process has its own independent counter. With `workers = cpu_count/2 + 1` workers (likely 5–9 on an i9), the effective rate limit is 5–9× higher than configured.

Your Django backend (`backend`, port 9000) has no rate limiting at all. Login, OTP, and password reset endpoints are open to unlimited brute-force attempts.

### Specific locations in your codebase

- `fast_backend/app/conf/rate_limiting.py`: in-process `AsyncSlidingWindowCounter` — not shared across Gunicorn workers
- `backend/dashboard/views.py`: no `@ratelimit` decorators on any view
- `backend/main/urls.py`: login/auth routes under `Basic.urls` and `authapp` — unprotected

### Solutions

**1 — Add rate limiting to Django using django-ratelimit**

```bash
pip install django-ratelimit
# Add to backend/requirements.txt
```

```python
# backend/authapp/views.py (or wherever login/OTP views live)
from django_ratelimit.decorators import ratelimit

@ratelimit(key="ip", rate="10/15m", method="POST", block=True)
def login_view(request): ...

@ratelimit(key="ip", rate="5/h", method="POST", block=True)
def otp_verify(request): ...
```

**2 — Replace in-process FastAPI rate limiter with Redis-backed rate limiting**

```python
# fast_backend/app/conf/rate_limiting.py — replace AsyncSlidingWindowCounter
# with slowapi (Redis-backed, works across all Gunicorn workers)

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri="redis://redis:6379/2")
```

**3 — Add GeoServer tile request limiting via Nginx**

```nginx
# nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=geoserver:10m rate=30r/s;

location /geoserver/ {
    limit_req zone=geoserver burst=50 nodelay;
    proxy_pass http://geoserver:8080/geoserver/;
}
```

---

## ISSUE 12 — Three Separate Databases, Alembic Not Run on Startup `MEDIUM`

### What's happening

Your system uses three PostgreSQL databases (`slcr`, `slcr_cloud`, `slcr_fastm`) in one PostgreSQL instance. Django manages users in `slcr`. FastAPI reads/writes `slcr_cloud`. FastM reads/writes `slcr_fastm`. There are no foreign key constraints between databases, so orphaned records can accumulate.

Additionally, **neither `fast_backend` nor `fast_m` run Alembic migrations on container startup**. Django runs `python manage.py migrate` on startup, but the FastAPI services just start Uvicorn/Gunicorn directly. If the schema is behind, queries fail silently.

### Specific locations in your codebase

- `docker-compose.yml` line 88: `fast_m` command is `uvicorn app.main:app --host 0.0.0.0 --port 7100 --reload` — no migration
- `docker-compose.yml` line 110: `fast_backend` command is `gunicorn app.main:app --config gunicorn.conf.py --reload` — no migration
- `database/init-databases.sql`: creates `slcr`, `slcr_fastm`, `slcr_cloud` — correct

### Solutions

**1 — Run Alembic migrations automatically on startup**

```yaml
# docker-compose.yml
fast_backend:
  command: >
    sh -c "alembic upgrade head &&
           gunicorn app.main:app --config gunicorn.conf.py"

fast_m:
  command: >
    sh -c "alembic upgrade head &&
           uvicorn app.main:app --host 0.0.0.0 --port 7100"
```

**2 — Remove --reload in production**

Both `fast_m` and `fast_backend` use `--reload` in their commands. `--reload` watches for file changes and restarts the worker — this is a development feature. In production it wastes CPU and causes unpredictable restarts:

```yaml
fast_m:
  command: uvicorn app.main:app --host 0.0.0.0 --port 7100  # no --reload

fast_backend:
  command: gunicorn app.main:app --config gunicorn.conf.py   # no --reload
```

**3 — Long-term: consolidate to one database with schemas**

```sql
-- Single database, three schemas — foreign keys work across schemas
CREATE SCHEMA django_app;
CREATE SCHEMA fastapi_app;
CREATE SCHEMA fast_m;
```

---

## ISSUE 13 — FastAPI CORS Allows All Methods and Headers `MEDIUM`

### What's happening

`fast_backend/app/main.py` line 46–49:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", Settings().DOMAIN],
    allow_credentials=True,
    allow_methods=["*"],        # allows DELETE, PATCH, PUT from any listed origin
    allow_headers=["*"],        # allows any header including custom attack vectors
)
```

`Settings().DOMAIN` resolves to `"localhost:7000"` from `fastdb.txt` line 37 — this is the Docker-internal hostname. In production, `localhost:7000` on the Vercel build server is not your API server, so the CORS origin list is effectively just `http://localhost:3000`.

### Specific locations in your codebase

- `fast_backend/app/main.py` lines 44–50: CORS config
- `fast_backend/fastdb.txt` line 37: `DOMAIN="localhost:7000"` — wrong for production

### Solutions

**1 — Restrict methods and headers, fix the DOMAIN value**

```python
# fast_backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ["ALLOWED_ORIGIN"],   # set to https://slcrdss.in in production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

**2 — Fix DOMAIN in environment file**

```
# fast_backend/.fastdb.env
DOMAIN=https://slcrdss.in

# And add:
ALLOWED_ORIGIN=https://slcrdss.in
```

---

## ISSUE 14 — frontend/env.txt Has Wrong WebSocket URL and Exposed JWT Secret `CRITICAL`

### What's happening

`frontend/env.txt` contains two critical problems:

**Problem A:** Line 7: `NEXT_PUBLIC_WEBSOCKET_URL = wss://fast_backend:7000/api`
`fast_backend` is a Docker internal hostname. It only resolves inside the Docker network. From a user's browser on Vercel, this hostname does not exist. Every WebSocket connection fails immediately.

**Problem B:** Line 5: `NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/wD5d+uDXVIGPVzYDdzkyJtns8uZ0Q`
This is the same JWT signing key used by FastAPI (`SECRET_KEY` in `fastdb.txt`). `NEXT_PUBLIC_` variables are baked into the JavaScript bundle shipped to every browser. Any user can open DevTools and extract the JWT signing key, then forge tokens.

**Problem C:** Line 13: `NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = ws://localhost:9000/django`
Plain `ws://` connections are rejected by Cloudflare Tunnel. Must be `wss://`.

### Specific locations in your codebase

- `frontend/env.txt` line 5: `NEXT_PUBLIC_SECRET` — JWT key exposed to browser
- `frontend/env.txt` line 7: `wss://fast_backend:7000/api` — Docker hostname, unreachable from browser
- `frontend/env.txt` line 13: `ws://localhost:9000/django` — plain ws://, rejected by Cloudflare

### Solutions

**1 — Remove NEXT_PUBLIC_SECRET completely**

```
# frontend/.env — corrected
# Remove this line entirely:
# NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/...

# Keep MY_VERIFY_KEY for server-side use in proxy.ts only
MY_VERIFY_KEY=<rotated-value>
```

**2 — Fix WebSocket URLs to use your public domain**

```
# frontend/.env — corrected WebSocket URLs
NEXT_PUBLIC_WEBSOCKET_URL = wss://slcrdss.in/api/ws
NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = wss://slcrdss.in/django/ws
```

**3 — Note: most API URLs are already correct via Next.js proxy**

Your `next.config.ts` rewrites `/api/*`, `/geoserver/*`, `/django/*`, `/fastapi/*`, and `/token/*` to Docker-internal hostnames server-side. This is the correct pattern — these never touch the browser's CORS policy. The frontend env variables for these routes correctly use relative paths:
- `NEXT_PUBLIC_BASE_URL = /api` ✓
- `NEXT_PUBLIC_GEOSERVER_URL = /geoserver` ✓
- `NEXT_PUBLIC_DJANGO_URL = /django` ✓

**Only the WebSocket URLs and the exposed secret need fixing** in `env.txt`.

---

## ISSUE 15 — proxy.ts Does Not Validate Token Expiry `MEDIUM`

### What's happening

`frontend/proxy.ts` checks only for the presence of the `verified_token` cookie:

```typescript
const VerifyToken = request.cookies.get("verified_token")?.value;
if (!VerifyToken) {
  // redirect to login
}
return NextResponse.next();  // token exists = access granted, no expiry check
```

An expired token passes this check. A user whose token expired hours ago is still served protected routes until their cookie is cleared. Additionally, there is a typo in the public routes list: `/dss/about/vission` (should be `vision`).

### Specific locations in your codebase

- `frontend/proxy.ts` line 40–47: token presence check only, no expiry validation
- `frontend/proxy.ts` line 8: typo `/dss/about/vission`

### Solutions

**1 — Validate token expiry in middleware using MY_VERIFY_KEY**

```typescript
// frontend/proxy.ts
import { jwtVerify } from "jose";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ... existing bypass logic ...

  const token = request.cookies.get("verified_token")?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const secret = new TextEncoder().encode(process.env.MY_VERIFY_KEY);
    await jwtVerify(token, secret);   // throws if expired or invalid
  } catch {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/", request.url);
  url.searchParams.set("auth_error", "auth_required");
  return NextResponse.redirect(url);
}
```

**2 — Fix the typo in public routes**

```typescript
const PUBLIC_DSS_ROUTES = [
  "/dss/about/objective",
  "/dss/about/vision",        // was "vission"
  "/dss/about/corevalue",
  // ...
];
```

---

## Priority Checklist

| Priority | Issue | Effort |
|----------|-------|--------|
| **CRITICAL** | Rotate all exposed credentials — DB (admin/admin), GeoServer (admin/geoserver), JWT key, both email app passwords | 2 hours |
| **CRITICAL** | Remove `NEXT_PUBLIC_SECRET` from `frontend/env.txt` | 15 min |
| **CRITICAL** | Fix WebSocket URLs — change `wss://fast_backend:7000/api` → `wss://slcrdss.in/api/ws` | 15 min |
| **CRITICAL** | Add `.gitignore` entries for all `.env` and `fastdb.txt` files | 15 min |
| **HIGH** | Add Docker health checks to all services (Issue 02) | 2 hours |
| **HIGH** | Fix `database` depends_on — it should not depend on `geoserver` | 15 min |
| **HIGH** | Set up automated database backups with `del.sh` safety guard (Issue 04) | 3 hours |
| **HIGH** | Add GiST spatial indexes via Alembic migration (Issue 05) | 2 hours |
| **HIGH** | Increase `ACCESS_TOKEN_EXPIRE_MINUTES` from 1 to 60 (Issue 07) | 15 min |
| **HIGH** | Remove `database` ports `5450:5432` and `redis` ports `6379:6379` from host binding (Issue 09) | 30 min |
| **MEDIUM** | Add Flower basic authentication (Issue 06) | 30 min |
| **MEDIUM** | Remove `print()` statements from `settings.py` lines 200–202 (Issue 08) | 15 min |
| **MEDIUM** | Mount log directories as Docker volumes so logs persist (Issue 08) | 30 min |
| **MEDIUM** | Add Nginx reverse proxy as single entry point (Issue 09) | 4 hours |
| **MEDIUM** | Fix CORS origin/methods in `fast_backend/app/main.py` and set correct `DOMAIN` (Issue 13) | 30 min |
| **MEDIUM** | Run Alembic migrations on `fast_backend` and `fast_m` startup (Issue 12) | 30 min |
| **MEDIUM** | Remove `--reload` flag from `fast_m` and `fast_backend` production commands (Issue 12) | 15 min |
| **MEDIUM** | Add rate limiting to Django views with `django-ratelimit` (Issue 11) | 2 hours |
| **MEDIUM** | Replace in-process FastAPI rate limiter with Redis-backed `slowapi` (Issue 11) | 2 hours |
| **MEDIUM** | Add token expiry validation to `proxy.ts` middleware (Issue 15) | 1 hour |
| **MEDIUM** | Fix typo `/dss/about/vission` → `vision` in `proxy.ts` (Issue 15) | 5 min |
| **MEDIUM** | Set up GitHub Actions CI/CD pipeline (Issue 10) | 3 hours |
| **LOW** | Pin Flower image from `mher/flower:latest` to exact version | 15 min |
| **LOW** | Consolidate three databases into one with schemas (Issue 12) | 1 week |
| **LOW** | Enable GeoWebCache tile caching in GeoServer admin panel | 1 hour |

---

**Stack verified against:**
`docker-compose.yml` · `backend/main/settings.py` · `fast_backend/fastdb.txt` · `fast_backend/app/main.py` · `fast_backend/app/conf/celery.py` · `fast_backend/app/conf/logging.py` · `fast_backend/app/conf/rate_limiting.py` · `fast_backend/app/database/models/model_gwz.py` · `fast_backend/app/database/models/model_stp.py` · `frontend/env.txt` · `frontend/proxy.ts` · `frontend/next.config.ts` · `database/init-databases.sql` · `del.sh`

**Date:** May 2026 · **Version:** 2.0 · **Project:** WaterDSS — slcrdeployment
