/** slide-scripts.txt 로드 · 파싱 (presenter.html에서 initSlideScripts() 호출) */
let SLIDE_TITLES = [];
let SLIDE_SCRIPTS = [];

function formatScriptMarkup(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*([^*]+)\*\*/g, '<span class="script-em">$1</span>');
}

function parseSlideScriptsFile(raw) {
    const titles = [];
    const scripts = [];
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

        const body = bodyLines.join('\n').trim();
        if (!body && !title) continue;

        titles.push(title || `슬라이드 ${titles.length + 1}`);
        scripts.push(formatScriptMarkup(body));
    }

    return { titles, scripts };
}

async function loadSlideScriptsRaw() {
    if (typeof window.SLIDE_SCRIPTS_RAW === 'string' && window.SLIDE_SCRIPTS_RAW.trim()) {
        return window.SLIDE_SCRIPTS_RAW;
    }

    if (location.protocol !== 'file:') {
        try {
            const res = await fetch(`slide-scripts.txt?_${Date.now()}`);
            if (res.ok) return await res.text();
        } catch (_) { /* file:// 또는 네트워크 오류 → raw.js fallback */ }
    }

    return null;
}

async function initSlideScripts() {
    const raw = await loadSlideScriptsRaw();
    if (!raw) {
        throw new Error('slide-scripts.raw.js가 없습니다. slide-scripts.txt 수정 후 node sync-scripts.mjs 실행');
    }

    const parsed = parseSlideScriptsFile(raw);
    if (!parsed.scripts.length) throw new Error('slide-scripts.txt에 스크립트가 없습니다.');

    SLIDE_TITLES = parsed.titles;
    SLIDE_SCRIPTS = parsed.scripts;
    return parsed;
}
