#!/usr/bin/env bash
# Construye el rootfs de la distro (Ubuntu noble arm64) con apt y lo trocea con manifest.
# Uso: build-rootfs.sh <directorio_salida>
set -euo pipefail
OUT="${1:?directorio de salida}"
mkdir -p "$OUT"
NAME=qwenan-rootfs-noble-arm64
PKGS="ca-certificates curl git python3 python3-venv libatomic1 build-essential"

# 1) Instalar paquetes dentro de un contenedor arm64 (binfmt ya registrado).
CID=$(docker create --platform linux/arm64 ubuntu:noble bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends $PKGS >/dev/null
  apt-get clean
  rm -rf /var/lib/apt/lists/*
  echo '$(date -u +%Y-%m-%dT%H:%M:%SZ)' > /etc/qwenan-rootfs-built-at
")
docker start -a "$CID"
echo "::notice::paquetes instalados en contenedor $CID"

# 2) Exportar el sistema de archivos y comprimirlo.
docker export "$CID" | zstd -19 -T0 --long=27 -o "$OUT/$NAME.tar.zst"
docker rm "$CID" >/dev/null

# 3) Verificar el artefacto: importarlo y usar apt dentro.
zstd -dc "$OUT/$NAME.tar.zst" | docker import --platform linux/arm64 - qwenan-rootfs:verify >/dev/null
docker run --rm --platform linux/arm64 qwenan-rootfs:verify bash -c '
  set -e
  apt-get update -qq
  apt-get -s upgrade >/dev/null && echo "apt upgrade (simulado) ok"
  git --version; python3 -V; dpkg -s libatomic1 | grep -E "^Status"
  uname -m
' | while IFS= read -r l; do echo "::notice::verify: $l"; done

# 4) Trocear en fragmentos de 64 MiB con SHA-256 y generar manifest.json.
cd "$OUT"
FILE="$NAME.tar.zst"
CHUNK=$((64*1024*1024))
split -b "$CHUNK" -d -a 3 "$FILE" "$NAME.part-"
python3 - "$FILE" "$NAME" "$CHUNK" <<'PY'
import hashlib, json, os, glob, sys
file, name, chunk = sys.argv[1], sys.argv[2], int(sys.argv[3])
def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()
parts = sorted(glob.glob(f"{name}.part-*"))
chunks, offset = [], 0
for i, p in enumerate(parts):
    size = os.path.getsize(p)
    chunks.append({"index": i, "name": p, "offset": offset, "size": size, "sha256": sha(p)})
    offset += size
manifest = {
    "distro": "ubuntu-noble",
    "arch": "arm64",
    "file": file,
    "size": offset,
    "sha256": sha(file),
    "chunkSize": chunk,
    "chunks": chunks,
}
json.dump(manifest, open("manifest.json", "w"), indent=2)
print(f"manifest: {len(chunks)} fragmentos, {offset} bytes")
PY
rm -f "$FILE"
ls -la "$OUT" | sed 's/^/::notice::/'
