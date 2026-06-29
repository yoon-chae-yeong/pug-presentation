import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const txtPath = path.join(dir, 'slide-scripts.txt');
const outPath = path.join(dir, 'slide-scripts.raw.js');

const txt = fs.readFileSync(txtPath, 'utf8');
const escaped = txt
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

const out = `/** slide-scripts.txt에서 자동 생성 — 직접 수정하지 마세요. 수정 후: node sync-scripts.mjs */
window.SLIDE_SCRIPTS_RAW = \`${escaped}\`;
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('slide-scripts.raw.js 생성 완료');
