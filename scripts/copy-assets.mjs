import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const copies = [
  {
    src: path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    dest: path.join(publicDir, 'sql-wasm.wasm'),
  },
  {
    src: path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    dest: path.join(publicDir, 'pdf.worker.min.mjs'),
  },
];

for (const { src, dest } of copies) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[copy-assets] Copiado: ${path.basename(dest)}`);
  } else {
    console.warn(`[copy-assets] Aviso: arquivo não encontrado em ${src}`);
  }
}
