import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const txtPath = path.join(dir, 'slide-scripts.txt');
const rawPath = path.join(dir, 'slide-scripts.raw.js');
const bundlePath = path.join(dir, 'slide-scripts.bundle.js');
const fromRaw = process.argv.includes('--from-raw');

function formatScriptMarkup(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*([^*]+)\*\*/g, '<span class="script-em">$1</span>')
        .replace(/\n/g, '<br>');
}

function parseSlideScriptsFile(raw) {
    const titles = [];
    const scripts = [];
    const navSkip = [];
    const blocks = raw.split(/\r?\n-{3,}\r?\n/);

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        if (/^>\s/.test(trimmed) && !trimmed.includes('\n#')) continue;

        const lines = trimmed.split(/\r?\n/);
        let title = '';
        let bodyLines = lines;

        if (lines[0]?.startsWith('# ')) {
            title = lines[0].slice(2).trim();
            bodyLines = lines.slice(1);
        }

        let skipNav = false;
        const contentLines = [];
        for (const line of bodyLines) {
            if (/^>\s*nav-skip\s*$/i.test(line.trim())) {
                skipNav = true;
                continue;
            }
            contentLines.push(line);
        }

        const body = contentLines.join('\n').trim();
        if (!body && !title) continue;

        titles.push(title || `슬라이드 ${titles.length + 1}`);
        scripts.push(formatScriptMarkup(body));
        navSkip.push(skipNav);
    }

    return { titles, scripts, navSkip };
}

function readRawJsContent() {
    const rawJs = fs.readFileSync(rawPath, 'utf8');
    const start = rawJs.indexOf('window.SLIDE_SCRIPTS_RAW = `');
    if (start === -1) throw new Error('slide-scripts.raw.js 형식이 올바르지 않습니다.');
    const contentStart = start + 'window.SLIDE_SCRIPTS_RAW = `'.length;
    const end = rawJs.lastIndexOf('`;');
    if (end <= contentStart) throw new Error('slide-scripts.raw.js 끝 구문을 찾을 수 없습니다.');
    return rawJs.slice(contentStart, end);
}

function writeRawJs(txt) {
    const escaped = txt
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');

    fs.writeFileSync(rawPath, `/** slide-scripts.txt / sync-scripts.mjs 에서 생성 */
window.SLIDE_SCRIPTS_RAW = \`${escaped}\`;
`, 'utf8');
}

function writeBundle(parsed) {
    const build = Date.now();
    const buildLabel = new Date(build).toLocaleString('ko-KR', { hour12: false });
    fs.writeFileSync(bundlePath, `/** presenter가 로드하는 파일 — 직접 수정하지 마세요 */
window.SLIDE_SCRIPTS_BUNDLE = ${JSON.stringify({ build, buildLabel, titles: parsed.titles, scripts: parsed.scripts, navSkip: parsed.navSkip || [] }, null, 0)};
`, 'utf8');
    return buildLabel;
}

let txt;
if (fromRaw) {
    txt = readRawJsContent();
    fs.writeFileSync(txtPath, txt, 'utf8');
    console.log('slide-scripts.raw.js → slide-scripts.txt 반영');
} else {
    txt = fs.readFileSync(txtPath, 'utf8');
    writeRawJs(txt);
}

const parsed = parseSlideScriptsFile(txt);
const buildLabel = writeBundle(parsed);

console.log(`동기화 완료 · ${parsed.scripts.length}개 슬라이드 · ${buildLabel}`);
if (fromRaw) {
    console.log('→ raw.js 수정 후: node sync-scripts.mjs --from-raw');
} else {
    console.log('→ txt 수정 후: node sync-scripts.mjs');
}
console.log('→ presenter.html 새로고침 (F5)');
