# Trocea archivos en fragmentos de 64 MiB con SHA-256 y escribe manifest.json.
# Uso: chunk.py <directorio> <archivo1> [archivo2 ...]
import hashlib, json, os, sys

CHUNK = 64 * 1024 * 1024

def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def main():
    out, files = sys.argv[1], sys.argv[2:]
    assets = []
    for file in files:
        name = os.path.basename(file)
        size = os.path.getsize(file)
        chunks = []
        with open(file, 'rb') as f:
            i = 0
            while True:
                data = f.read(CHUNK)
                if not data:
                    break
                part = f"{name}.part-{i:03d}"
                with open(os.path.join(out, part), 'wb') as g:
                    g.write(data)
                chunks.append({"index": i, "name": part, "size": len(data),
                               "sha256": hashlib.sha256(data).hexdigest()})
                i += 1
        assets.append({"file": name, "size": size, "sha256": sha(file),
                       "chunkSize": CHUNK, "chunks": chunks})
        os.remove(file)
    json.dump({"assets": assets}, open(os.path.join(out, "manifest.json"), "w"), indent=2)
    resumen = "; ".join(f"{a['file']} {a['size']}B {len(a['chunks'])} fragmentos" for a in assets)
    print(f"::notice::ASSETS {resumen}")

if __name__ == '__main__':
    main()
