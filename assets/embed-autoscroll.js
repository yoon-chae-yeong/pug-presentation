(function () {
    if (window.self === window.top) return;

    let raf = null;
    let state = null;
    let retryTimer = null;
    let readyTimer = null;

    function getMetrics() {
        const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const viewHeight = window.innerHeight || document.documentElement.clientHeight;
        return {
            contentHeight: scrollHeight,
            viewHeight,
            maxScroll: Math.max(0, scrollHeight - viewHeight)
        };
    }

    function setScroll(y) {
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
    }

    function nextStepTarget(pos, maxScroll, stepPx) {
        return Math.min(maxScroll, pos + stepPx);
    }

    function stop() {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        if (readyTimer) {
            clearTimeout(readyTimer);
            readyTimer = null;
        }
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        state = null;
    }

    function publishReady() {
        const { contentHeight, viewHeight, maxScroll } = getMetrics();
        if (contentHeight < 80) return false;
        try {
            window.parent.postMessage({
                type: 'pug-embed-scroll',
                action: 'ready',
                contentHeight,
                viewHeight,
                maxScroll
            }, '*');
        } catch (_) {}
        return maxScroll >= 16;
    }

    function scheduleReadyAnnounce(attempt) {
        if (publishReady()) return;
        if ((attempt || 0) >= 60) return;
        readyTimer = setTimeout(
            () => scheduleReadyAnnounce((attempt || 0) + 1),
            (attempt || 0) === 0 ? 0 : 100
        );
    }

    function tick(ts) {
        if (!state) return;

        const maxScroll = getMetrics().maxScroll;
        if (maxScroll < 16) {
            stop();
            return;
        }

        if (ts < state.pauseUntil) {
            raf = requestAnimationFrame(tick);
            return;
        }

        if (state.resetPending) {
            state.resetPending = false;
            state.pos = 0;
            setScroll(0);
            state.stepTarget = Math.min(state.stepPx, maxScroll);
            state.lastTs = ts;
            raf = requestAnimationFrame(tick);
            return;
        }

        const dt = Math.min(ts - state.lastTs, 48) / 1000;
        state.lastTs = ts;
        state.pos += state.speed * dt;

        if (state.pos < state.stepTarget) {
            setScroll(state.pos);
            raf = requestAnimationFrame(tick);
            return;
        }

        state.pos = Math.min(state.pos, state.stepTarget);
        setScroll(state.pos);

        if (state.pos >= maxScroll - 0.5) {
            state.pos = maxScroll;
            setScroll(state.pos);
            state.resetPending = true;
            state.pauseUntil = ts + state.turnPause;
        } else {
            state.stepTarget = nextStepTarget(state.pos, maxScroll, state.stepPx);
            state.pauseUntil = ts + state.stepPause;
        }

        raf = requestAnimationFrame(tick);
    }

    function start(speed, turnPause, startPause, stepPx, stepPause) {
        stop();
        const { maxScroll } = getMetrics();
        if (maxScroll < 16) return false;

        const step = stepPx ?? 240;
        const midPause = stepPause ?? 480;
        const turn = turnPause ?? 650;
        const startDelay = startPause ?? 80;

        setScroll(0);
        state = {
            pos: 0,
            resetPending: false,
            speed: speed || 220,
            turnPause: turn,
            stepPx: step,
            stepPause: midPause,
            stepTarget: Math.min(step, maxScroll),
            pauseUntil: performance.now() + startDelay,
            lastTs: performance.now()
        };
        raf = requestAnimationFrame(tick);
        return true;
    }

    function startWithRetry(speed, turnPause, startPause, stepPx, stepPause, attempt) {
        if (start(speed, turnPause, startPause, stepPx, stepPause)) return;
        if ((attempt || 0) >= 80) return;
        retryTimer = setTimeout(
            () => startWithRetry(speed, turnPause, startPause, stepPx, stepPause, (attempt || 0) + 1),
            (attempt || 0) === 0 ? 0 : 80
        );
    }

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.type !== 'pug-embed-scroll') return;
        if (d.action === 'stop') stop();
        else if (d.action === 'start') {
            startWithRetry(d.speed, d.pause, d.startPause, d.stepPx, d.stepPause, 0);
        } else if (d.action === 'request-ready') {
            scheduleReadyAnnounce(0);
        }
    });

    scheduleReadyAnnounce(0);
    window.addEventListener('load', () => scheduleReadyAnnounce(0));

    window.__pugEmbedScroll = { start, stop, getMetrics, publishReady };
})();
