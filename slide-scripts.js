/** slide-scripts.txt 로드 · 파싱 (presenter.html에서 initSlideScripts() 호출) */
let SLIDE_TITLES = [];
let SLIDE_SCRIPTS = [];
let SLIDE_NAV_SKIP = [];
let SLIDE_SCRIPTS_BUILD = '';

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

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`로드 실패: ${url}`));
        document.head.appendChild(s);
    });
}

async function loadSlideScriptsBundle() {
    delete window.SLIDE_SCRIPTS_BUNDLE;
    await loadScript(`slide-scripts.bundle.js?_${Date.now()}`);
    const bundle = window.SLIDE_SCRIPTS_BUNDLE;
    if (!bundle?.scripts?.length) {
        throw new Error('slide-scripts.bundle.js가 비어 있습니다. node sync-scripts.mjs 실행');
    }
    SLIDE_TITLES = bundle.titles;
    SLIDE_SCRIPTS = bundle.scripts;
    SLIDE_NAV_SKIP = bundle.navSkip || [];
    SLIDE_SCRIPTS_BUILD = bundle.buildLabel || '';
    return { titles: SLIDE_TITLES, scripts: SLIDE_SCRIPTS, navSkip: SLIDE_NAV_SKIP };
}

async function loadSlideScriptsRawFallback() {
    delete window.SLIDE_SCRIPTS_RAW;

    if (location.protocol !== 'file:') {
        try {
            const res = await fetch(`slide-scripts.txt?_${Date.now()}`);
            if (res.ok) return await res.text();
        } catch (_) { /* raw.js fallback */ }
    }

    await loadScript(`slide-scripts.raw.js?_${Date.now()}`);
    if (typeof window.SLIDE_SCRIPTS_RAW === 'string' && window.SLIDE_SCRIPTS_RAW.trim()) {
        return window.SLIDE_SCRIPTS_RAW;
    }
    return null;
}

async function initSlideScripts() {
    try {
        return await loadSlideScriptsBundle();
    } catch (bundleErr) {
        console.warn('[발표자] bundle 로드 실패, txt/raw 파싱 시도:', bundleErr.message);
    }

    const raw = await loadSlideScriptsRawFallback();
    if (!raw) {
        throw new Error('스크립트 파일이 없습니다. slide-scripts.txt 수정 후 node sync-scripts.mjs 실행');
    }

    const parsed = parseSlideScriptsFile(raw);
    if (!parsed.scripts.length) throw new Error('slide-scripts.txt에 스크립트가 없습니다.');

    SLIDE_TITLES = parsed.titles;
    SLIDE_SCRIPTS = parsed.scripts;
    SLIDE_NAV_SKIP = parsed.navSkip || [];
    SLIDE_SCRIPTS_BUILD = '(txt 직접 파싱)';
    return parsed;
}
