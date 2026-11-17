#!/usr/bin/env bash
# Construye los assets de runtime para Android: Node 26.13.1 linux-arm64 y el bundle de
# Qwen Code (v0.28.0 + parches), troceados con manifest, y los verifica reensamblando.
# Uso: build-assets.sh <directorio_salida>
set -euo pipefail
mkdir -p "$1"
OUT="$(cd "$1" && pwd)"
trap 'echo "::error::fallo en build-assets.sh línea $LINENO: $BASH_COMMAND"' ERR
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$RUNNER_TEMP/assets-work"; rm -rf "$WORK"; mkdir -p "$WORK"
NODE_VERSION="${NODE_VERSION:-26.13.1}"
QWEN_TAG="${QWEN_CODE_TAG:-v0.28.0}"

# 1) Node arm64 verificado con SHASUMS256.txt.
cd "$WORK"
BASE=https://nodejs.org/dist/v${NODE_VERSION}
curl -fsSLO "$BASE/SHASUMS256.txt"
NODE_TAR=node-v${NODE_VERSION}-linux-arm64.tar.xz
curl -fsSLO "$BASE/$NODE_TAR"
grep " $NODE_TAR\$" SHASUMS256.txt > node.sha256 && sha256sum -c node.sha256
tar -xJf "$NODE_TAR" && mv "node-v${NODE_VERSION}-linux-arm64" node

# 2) Código de qwen-code con parches.
git clone --depth 1 --branch "$QWEN_TAG" https://github.com/QwenLM/qwen-code.git src
cd src
for p in "$ROOT"/patches/qwen-code/*.patch; do
  echo "::notice::aplicando $(basename "$p")"
  git apply "$p"
done
rm -rf .git

# 3) Build amd64 (host).
export NODE_OPTIONS=--max-old-space-size=6144
npm i -g pnpm@11.24.0 >/dev/null 2>&1
pnpm install --frozen-lockfile --ignore-scripts
node scripts/build.js
cd "$WORK"

# 4) Dependencias de producción nativas arm64 (dentro de la distro).
docker run --rm --platform linux/arm64 \
  -v "$WORK/node:/opt/node:ro" -v "$WORK/src:/src" -e CI=true \
  ubuntu:noble bash -c '
    set -euo pipefail
    apt-get update -qq && apt-get install -y -qq libatomic1 ca-certificates >/dev/null
    export PATH=/opt/node/bin:$PATH
    npm i -g --prefix /usr/local pnpm@11.24.0 >/dev/null
    cd /src
    pnpm install --prod --frozen-lockfile --ignore-scripts
    echo "::notice::prod install arm64 ok ($(uname -m), node $(node -v))"
  '

# 5) Empaquetar.
tar -C "$WORK" -cf - src | zstd -19 -T0 --long=27 -o "$WORK/qwen-code-${QWEN_TAG#v}-linux-arm64.tar.zst"
tar -C "$WORK" -cf - node | zstd -19 -T0 --long=27 -o "$WORK/node-${NODE_VERSION}-linux-arm64.tar.zst"

# 6) Trocear y manifest.
python3 "$HERE/chunk.py" "$OUT" "$WORK/node-${NODE_VERSION}-linux-arm64.tar.zst" "$WORK/qwen-code-${QWEN_TAG#v}-linux-arm64.tar.zst"
cp "$HERE/chunk.py" "$OUT/"
ls -la "$OUT" | sed 's/^/::notice::/'

# 7) Verificación: reensamblar desde fragmentos, comprobar SHA-256 y arrancar qwen serve con el Node empaquetado.
python3 - "$OUT" "$WORK/reassembled" <<'PY'
import hashlib, json, os, sys
out, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
m = json.load(open(os.path.join(out, 'manifest.json')))
for a in m['assets']:
    h = hashlib.sha256()
    with open(os.path.join(dst, a['file']), 'wb') as f:
        for c in a['chunks']:
            data = open(os.path.join(out, c['name']), 'rb').read()
            assert hashlib.sha256(data).hexdigest() == c['sha256'], c['name']
            h.update(data); f.write(data)
    assert h.hexdigest() == a['sha256'], a['file']
    print(f"::notice::reensamblado {a['file']} ok ({len(a['chunks'])} fragmentos)")
PY
docker run --rm --platform linux/arm64 -v "$WORK/reassembled:/assets:ro" ubuntu:noble bash -c '
  set -uo pipefail
  apt-get update -qq && apt-get install -y -qq zstd libatomic1 ca-certificates curl >/dev/null
  mkdir -p /opt/qwen && cd /opt/qwen
  zstd -dc /assets/node-*-linux-arm64.tar.zst | tar -x
  zstd -dc /assets/qwen-code-*-linux-arm64.tar.zst | tar -x
  NODE=/opt/qwen/node/bin/node
  echo "::notice::node $($NODE -v) arch $(uname -m)"
  mkdir -p /tmp/ws
  $NODE /opt/qwen/src/packages/cli/dist/index.js serve --port 4170 --hostname 127.0.0.1 --token t0k --workspace /tmp/ws >/tmp/serve.log 2>&1 &
  PID=$!
  for i in $(seq 1 60); do curl -fs http://127.0.0.1:4170/health >/dev/null 2>&1 && break; kill -0 $PID 2>/dev/null || break; sleep 2; done
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4170/health || true)
  echo "::notice::GET /health -> $code (bundle reensamblado)"
  if [ "$code" != "200" ]; then echo "::error::serve no respondió"; tail -n 30 /tmp/serve.log | while IFS= read -r l; do echo "::error::$l"; done; exit 1; fi
  kill $PID 2>/dev/null || true
'
