# Fusiona manifests en un único manifest.json con formato {"assets": [...]} que lee la app.
# Acepta el formato de build-assets (ya tiene "assets") y el de build-rootfs (un único archivo).
# Uso: merge-manifest.py <salida.json> <manifest1.json> [manifest2.json ...]
import json, sys

out, inputs = sys.argv[1], sys.argv[2:]
assets, names = [], set()
for path in inputs:
    m = json.load(open(path))
    entries = m['assets'] if 'assets' in m else [{
        'file': m['file'], 'size': m['size'], 'sha256': m['sha256'],
        'chunks': [{'name': c['name'], 'size': c['size'], 'sha256': c['sha256']} for c in m['chunks']],
    }]
    for a in entries:
        if a['file'] in names:
            raise SystemExit(f"archivo duplicado en los manifests: {a['file']}")
        names.add(a['file'])
        assets.append(a)
json.dump({'assets': assets}, open(out, 'w'), indent=2)
print(f"::notice::manifest fusionado: {len(assets)} assets, {sum(len(a['chunks']) for a in assets)} fragmentos")
