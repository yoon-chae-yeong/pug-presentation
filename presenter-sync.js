/** 같은 PC의 presentation.html ↔ presenter.html 슬라이드 동기화 */
(function (global) {
    const KEY = 'pug-presentation-sync';
    let channel = null;
    try { channel = new BroadcastChannel(KEY); } catch (_) {}

    function publish(slideIndex) {
        const payload = { slide: slideIndex, at: Date.now() };
        localStorage.setItem(KEY, JSON.stringify(payload));
        channel?.postMessage(payload);
    }

    function subscribe(fn) {
        const handle = (payload) => {
            if (payload && Number.isInteger(payload.slide)) fn(payload.slide);
        };
        window.addEventListener('storage', (e) => {
            if (e.key !== KEY || !e.newValue) return;
            try { handle(JSON.parse(e.newValue)); } catch (_) {}
        });
        channel?.addEventListener('message', (e) => handle(e.data));
    }

    function read() {
        try {
            const raw = localStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    global.PugDeckSync = { publish, subscribe, read, KEY };
})(window);
