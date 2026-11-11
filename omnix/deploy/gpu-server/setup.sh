#!/usr/bin/env bash
# OMNIX single-server setup for a GPU machine (Ubuntu 22.04/24.04, NVIDIA
# driver already installed — standard on GPU cloud images).
#
# Runs on one box: vLLM (Qwen3-8B + run-time LoRA), Ollama (bge-m3
# embeddings), the OMNIX web app, the Node background worker, the Python
# training worker, and Caddy (HTTPS).
# Database: PostgreSQL 16 + pgvector elsewhere (Neon/Supabase), given in
# /etc/omnix/omnix.env.
#
# Sizing: serving Qwen3-8B in bf16 (~16 GB weights + KV cache) AND QLoRA
# training (~13 GB) on the same GPU needs ~48 GB (1x L40S / RTX 6000 Ada /
# A6000). On a 24 GB card, set VLLM_GPU_UTIL=0.90 and run training on a
# second machine (WORKER_ONLY=1 there).
#
# STATUS: written for this project but NOT yet run on real GPU hardware.
# Read it before running; run as root:  sudo DOMAIN=omnix.example.com bash setup.sh
set -euo pipefail

DOMAIN="${DOMAIN:?set DOMAIN=your.domain (DNS A record must point at this server)}"
REPO="${REPO:-https://github.com/saadaljammaz35-stack/-.git}"
BRANCH="${BRANCH:-claude/keen-knuth-m3w14n}"
BASE_MODEL="${BASE_MODEL:-Qwen/Qwen3-8B}"
VLLM_GPU_UTIL="${VLLM_GPU_UTIL:-0.55}"
WORKER_ONLY="${WORKER_ONLY:-0}"
APP=/opt/omnix
SRC=$APP/src/omnix

command -v nvidia-smi >/dev/null || { echo "nvidia-smi not found: install the NVIDIA driver first"; exit 1; }
nvidia-smi --query-gpu=name,memory.total --format=csv

apt-get update -qq
apt-get install -y -qq git curl ca-certificates python3-venv python3-dev build-essential debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

id omnix >/dev/null 2>&1 || useradd --system --create-home --home-dir $APP --shell /usr/sbin/nologin omnix
mkdir -p $APP/storage $APP/adapters $APP/hf-cache /etc/omnix
if [ ! -d $APP/src/.git ]; then git clone --depth 1 --branch "$BRANCH" "$REPO" $APP/src; else git -C $APP/src pull --ff-only; fi

# ---- Python: vLLM and the trainer get separate virtualenvs (their torch pins differ).
python3 -m venv $APP/venv-vllm
$APP/venv-vllm/bin/pip install -q --upgrade pip
$APP/venv-vllm/bin/pip install -q vllm
python3 -m venv $APP/venv-trainer
$APP/venv-trainer/bin/pip install -q --upgrade pip
$APP/venv-trainer/bin/pip install -q torch --index-url https://download.pytorch.org/whl/cu124
$APP/venv-trainer/bin/pip install -q -r $SRC/worker/requirements.txt bitsandbytes

# ---- Node app
if [ "$WORKER_ONLY" != "1" ]; then
  (cd $SRC && npm ci --no-audit --no-fund)
fi

# ---- Configuration (secrets are filled in by you, never committed)
if [ ! -f /etc/omnix/omnix.env ]; then
  cat > /etc/omnix/omnix.env <<ENV
NODE_ENV=production
OMNIX_PUBLIC_ORIGIN=https://$DOMAIN
DATABASE_URL=postgres://omnix_app_login:CHANGE_ME@CHANGE_ME/omnix?sslmode=require
WORKER_DATABASE_URL=postgres://omnix_worker_login:CHANGE_ME@CHANGE_ME/omnix?sslmode=require
DATABASE_SSL=true
# Owner connection, used only to run migrations from this script.
MIGRATION_DATABASE_URL=postgres://CHANGE_ME_OWNER@CHANGE_ME/omnix?sslmode=require
OMNIX_SECRETS_KEY=$(openssl rand -base64 32)
OMNIX_STORAGE_DIR=$APP/storage
OMNIX_ARTIFACTS_DIR=$APP/adapters
OMNIX_INLINE_JOBS=false
OMNIX_TRUST_PROXY=true
OMNIX_LOCAL_ONNX_ENABLED=false
OMNIX_ALLOW_MODEL_DOWNLOAD=false
VLLM_URL=http://127.0.0.1:8000
OMNIX_PROVIDER_SECRET_VLLM=$(openssl rand -hex 24)
OMNIX_DEFAULT_BASE_MODEL=$BASE_MODEL
EMBEDDING_PROVIDER=ollama
EMBEDDING_URL=http://127.0.0.1:11434
EMBEDDING_MODEL=BAAI/bge-m3
HF_HOME=$APP/hf-cache
ENV
  chmod 600 /etc/omnix/omnix.env
  echo ">>> Edit /etc/omnix/omnix.env (database URLs), then re-run this script."
fi
chown -R omnix:omnix $APP
chown root:omnix /etc/omnix/omnix.env

install -m 644 $SRC/deploy/gpu-server/omnix-vllm.service /etc/systemd/system/
install -m 644 $SRC/deploy/gpu-server/omnix-trainer.service /etc/systemd/system/
sed -i "s|@BASE_MODEL@|$BASE_MODEL|; s|@GPU_UTIL@|$VLLM_GPU_UTIL|" /etc/systemd/system/omnix-vllm.service
UNITS="omnix-vllm omnix-trainer"

# ---- Embeddings: Ollama (its installer adds a loopback-only systemd service).
if ! command -v ollama >/dev/null; then curl -fsSL https://ollama.com/install.sh | sh; fi
systemctl enable --now ollama
ollama pull bge-m3
if [ "$WORKER_ONLY" != "1" ]; then
  install -m 644 $SRC/deploy/gpu-server/omnix-web.service /etc/systemd/system/
  install -m 644 $SRC/deploy/gpu-server/omnix-ai-worker.service /etc/systemd/system/
  UNITS="$UNITS omnix-web omnix-ai-worker"
fi
systemctl daemon-reload

if grep -q CHANGE_ME /etc/omnix/omnix.env; then
  echo ">>> /etc/omnix/omnix.env still has CHANGE_ME values; services not started."
  exit 0
fi

if [ "$WORKER_ONLY" != "1" ]; then
  set -a; . /etc/omnix/omnix.env; set +a
  # Schema first (takes a pg_dump backup when pg_dump is installed; also snapshot your database).
  (cd $SRC && runuser -u omnix --preserve-environment -- npm run db:migrate)
  (cd $SRC && runuser -u omnix --preserve-environment -- npm run build)
  # HTTPS reverse proxy with automatic certificates.
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy
  fi
  printf '%s {\n  encode zstd gzip\n  reverse_proxy 127.0.0.1:3200 {\n    flush_interval -1\n  }\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
  systemctl restart caddy
fi
systemctl enable --now $UNITS
echo "OMNIX is starting. vLLM needs a few minutes to download and load $BASE_MODEL: journalctl -fu omnix-vllm"
