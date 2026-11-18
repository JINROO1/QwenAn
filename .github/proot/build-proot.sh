#!/bin/bash
# Compila proot estático para linux/arm64 (Android lo ejecuta desde jniLibs).
# Se ejecuta dentro de ubuntu:noble arm64. Entrada: PROOT_TAG. Salida: /out/proot.
set -euo pipefail
TAG="${PROOT_TAG:-v5.5.0}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq build-essential pkg-config libtalloc-dev libarchive-dev curl ca-certificates file binutils >/dev/null
cd /tmp
curl -fsSL -o proot.tar.gz "https://github.com/proot-me/proot/archive/refs/tags/${TAG}.tar.gz"
tar xzf proot.tar.gz
cd proot-*/src
# LDFLAGS por entorno (no por línea de comandos): el Makefile hace LDFLAGS += ..., y así no se pierde -ltalloc.
LDFLAGS="-static" make -j"$(nproc)" proot >/tmp/make.log 2>&1 || { tail -c 1500 /tmp/make.log; exit 1; }
test -x proot
file proot
if readelf -d proot | grep -q NEEDED; then
  echo "::error::proot no es estático: $(readelf -d proot | grep NEEDED | tr '\n' ' ')"
  exit 1
fi
mkdir -p /out
cp proot /out/proot
# Prueba de humo: ptrace + exec dentro del mismo sistema.
ARCH="$(/out/proot -r / /bin/uname -m)"
echo "::notice::proot ${TAG} estático arm64; uname -m dentro de proot: ${ARCH}"
[ "$ARCH" = "aarch64" ] || { echo "::error::uname distinto de aarch64: $ARCH"; exit 1; }
echo "::notice::sha256 $(sha256sum /out/proot | cut -d' ' -f1)"
