/** slide-scripts.txt 로드 · 파싱 (presenter.html에서 initSlideScripts() 호출)
 *  Live Server 등 http(s)로 열어야 합니다. file:// 더블클릭은 지원하지 않습니다.
 */
let SLIDE_TITLES = [];
let SLIDE_SCRIPTS = [];

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
    if (location.protocol === 'file:') {
        throw new Error(
            'file://로 열면 스크립트를 불러올 수 없습니다. presenter.html을 Live Server(Open with Live Server)로 여세요.'
        );
    }

    const res = await fetch(`slide-scripts.txt?_${Date.now()}`);
    if (!res.ok) throw new Error(`slide-scripts.txt를 불러오지 못했습니다 (${res.status})`);
    return await res.text();
}

async function initSlideScripts() {
    const raw = await loadSlideScriptsRaw();
    const parsed = parseSlideScriptsFile(raw);
    if (!parsed.scripts.length) throw new Error('slide-scripts.txt에 스크립트가 없습니다.');

    SLIDE_TITLES = parsed.titles;
    SLIDE_SCRIPTS = parsed.scripts;
    return parsed;
}
