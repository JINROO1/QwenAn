// Prueba de nativos dentro de la distro arm64 (paso 1 del plan Android).
// Resultados en stdout: NATIVE_OK ... / NATIVE_FAIL ...
const req = require('module').createRequire('/src/packages/core/package.json');

try {
  const sharp = req('sharp');
  sharp({ create: { width: 2, height: 2, channels: 3, background: '#f00' } })
    .png()
    .toBuffer()
    .then((b) => console.log('NATIVE_OK sharp png_bytes=' + b.length))
    .catch((e) => console.log('NATIVE_FAIL sharp ' + e.message));
} catch (e) {
  console.log('NATIVE_FAIL sharp load ' + e.message);
}

try {
  const pty = req('@lydell/node-pty');
  const p = pty.spawn('/bin/sh', ['-c', 'echo pty-ok'], {});
  let out = '';
  p.onData((d) => (out += d));
  p.onExit(() => console.log('NATIVE_OK node-pty out=' + JSON.stringify(out.trim())));
} catch (e) {
  console.log('NATIVE_FAIL node-pty ' + e.message);
}
