(function () {
    if (window.self === window.top) return;

    let raf = null;
    let state = null;
    let retryTimer = null;

    function getMetrics() {
        const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const viewHeight = window.innerHeight || document.documentElement.clientHeight;
        return { maxScroll: Math.max(0, scrollHeight - viewHeight) };
    }

    function setScroll(y) {
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
    }

    function stop() {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        state = null;
    }

    function tick(ts) {
        if (!state) return;

        state.maxScroll = getMetrics().maxScroll;
        if (state.maxScroll < 16) {
            stop();
            return;
        }

        if (ts < state.pauseUntil) {
            raf = requestAnimationFrame(tick);
            return;
        }

        const dt = Math.min(ts - state.lastTs, 48) / 1000;
        state.lastTs = ts;
        state.pos += state.dir * state.speed * dt;

        if (state.pos >= state.maxScroll) {
            state.pos = state.maxScroll;
            state.dir = -1;
            state.pauseUntil = ts + state.turnPause;
        } else if (state.pos <= 0) {
            state.pos = 0;
            state.dir = 1;
            state.pauseUntil = ts + state.turnPause;
        }

        setScroll(state.pos);
        raf = requestAnimationFrame(tick);
    }

    function start(speed, turnPause, startPause) {
        stop();
        const { maxScroll } = getMetrics();
        if (maxScroll < 16) return false;

        const turn = turnPause ?? 650;
        const startDelay = startPause ?? 180;

        setScroll(0);
        state = {
            pos: 0,
            dir: 1,
            speed: speed || 220,
            turnPause: turn,
            maxScroll,
            pauseUntil: performance.now() + startDelay,
            lastTs: performance.now()
        };
        raf = requestAnimationFrame(tick);
        return true;
    }

    function startWithRetry(speed, turnPause, startPause, attempt) {
        if (start(speed, turnPause, startPause)) return;
        if ((attempt || 0) >= 80) return;
        retryTimer = setTimeout(
            () => startWithRetry(speed, turnPause, startPause, (attempt || 0) + 1),
            (attempt || 0) === 0 ? 0 : 80
        );
    }

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.type !== 'pug-embed-scroll') return;
        if (d.action === 'stop') stop();
        else if (d.action === 'start') startWithRetry(d.speed, d.pause, d.startPause, 0);
    });

    window.__pugEmbedScroll = { start, stop, getMetrics };
})();
