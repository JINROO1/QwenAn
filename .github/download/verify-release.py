# Verifica la descarga anónima de la release runtime-v1 con la misma lógica que la app:
# - descarga manifest.json y cada fragmento por HTTPS sin token;
# - reanuda con HTTP Range si el fragmento quedó a medias;
# - comprueba SHA-256 de cada fragmento antes de aceptarlo;
# - reensambla cada archivo y comprueba su SHA-256 completo.
# Uso: verify-release.py <base_url> <directorio_salida>
import hashlib, json, os, sys, time, urllib.request, urllib.error

BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
RETRIES = 6
# Prueba de reanudación: si CUT_AFTER > 0, el primer intento del primer fragmento se corta tras CUT_AFTER bytes.
CUT_AFTER = int(os.environ.get('CUT_AFTER', '0') or 0)
_cut_done = False
os.makedirs(OUT, exist_ok=True)


def notice(msg):
    print(f"::notice::{msg}", flush=True)


def error(msg):
    print(f"::error::{msg}", flush=True)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fetch(name, dest, expected_size, expected_sha):
    """Descarga name a dest, reanudando si ya existe un parcial. Verifica SHA-256."""
    url = f"{BASE}/{name}"
    for attempt in range(1, RETRIES + 1):
        have = os.path.getsize(dest) if os.path.exists(dest) else 0
        if have == expected_size and sha256_file(dest) == expected_sha:
            return
        if have > expected_size:
            os.remove(dest)
            have = 0
        headers = {'User-Agent': 'qwenan-verify'}
        if have > 0:
            headers['Range'] = f'bytes={have}-'
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                status = resp.status
                mode = 'ab' if (status == 206 and have > 0) else 'wb'
                if mode == 'wb':
                    have = 0
                global _cut_done
                with open(dest, mode) as f:
                    written = 0
                    while True:
                        block = resp.read(1 << 20)
                        if not block:
                            break
                        if CUT_AFTER and not _cut_done and have + written + len(block) > CUT_AFTER:
                            keep = CUT_AFTER - (have + written)
                            f.write(block[:keep])
                            f.flush()
                            _cut_done = True
                            raise OSError(f'corte simulado tras {CUT_AFTER} bytes')
                        f.write(block)
                        written += len(block)
                if mode == 'ab':
                    notice(f"reanudado {name} desde byte {have} (HTTP {status})")
        except (urllib.error.URLError, OSError) as e:
            print(f"reintento {attempt} para {name}: {e}", flush=True)
            time.sleep(min(2 ** attempt, 30))
            continue
        if os.path.getsize(dest) == expected_size and sha256_file(dest) == expected_sha:
            return
        print(f"reintento {attempt} para {name}: tamaño o SHA-256 no coinciden", flush=True)
        if os.path.getsize(dest) > expected_size:
            os.remove(dest)
        time.sleep(min(2 ** attempt, 30))
    raise SystemExit(f"no se pudo descargar {name} correctamente")


def main():
    manifest_path = os.path.join(OUT, 'manifest.json')
    fetch_manifest(manifest_path)
    manifest = json.load(open(manifest_path))
    for asset in manifest['assets']:
        target = os.path.join(OUT, asset['file'])
        parts = []
        for ch in asset['chunks']:
            part = os.path.join(OUT, ch['name'])
            fetch(ch['name'], part, ch['size'], ch['sha256'])
            parts.append(part)
        with open(target, 'wb') as out:
            for part in parts:
                with open(part, 'rb') as f:
                    while True:
                        b = f.read(1 << 20)
                        if not b:
                            break
                        out.write(b)
        digest = sha256_file(target)
        if digest != asset['sha256'] or os.path.getsize(target) != asset['size']:
            error(f"{asset['file']}: SHA-256 o tamaño final no coinciden")
            raise SystemExit(1)
        notice(f"{asset['file']} OK: {asset['size']} B, {len(parts)} fragmentos, sha256 verificado")
        for part in parts:
            os.remove(part)
    notice('DOWNLOAD_OK: runtime-v1 descargada anónimamente y verificada')


def fetch_manifest(dest):
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(f"{BASE}/manifest.json", headers={'User-Agent': 'qwenan-verify'})
            with urllib.request.urlopen(req, timeout=60) as resp:
                open(dest, 'wb').write(resp.read())
            return
        except (urllib.error.URLError, OSError) as e:
            print(f"reintento {attempt} manifest: {e}", flush=True)
            time.sleep(min(2 ** attempt, 30))
    raise SystemExit('no se pudo descargar manifest.json')


if __name__ == '__main__':
    main()
