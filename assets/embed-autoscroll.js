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

    function getScrollStops(maxScroll) {
        const nodes = Array.from(document.querySelectorAll('[data-scroll-stop]'));
        if (!nodes.length) return null;
        const tops = nodes
            .map(el => {
                const y = el.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop || 0);
                return Math.max(0, Math.min(maxScroll, Math.round(y - 8)));
            })
            .filter((y, i, arr) => y > 24 && (i === 0 || y > arr[i - 1] + 48));
        if (maxScroll > 0 && (tops.length === 0 || tops[tops.length - 1] < maxScroll - 24)) {
            tops.push(maxScroll);
        }
        return tops.length ? tops : null;
    }

    function setScroll(y) {
        const top = Math.round(y);
        window.scrollTo(0, top);
        document.documentElement.scrollTop = top;
        document.body.scrollTop = top;
    }

    function nextStepTarget(pos, maxScroll, stepPx, stops, stopIndex) {
        if (stops && stopIndex < stops.length) return stops[stopIndex];
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
        const stops = getScrollStops(maxScroll);
        try {
            window.parent.postMessage({
                type: 'pug-embed-scroll',
                action: 'ready',
                contentHeight,
                viewHeight,
                maxScroll,
                stops
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

        const maxScroll = state.maxScroll;
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
            state.stopIndex = 0;
            state.stepTarget = nextStepTarget(0, maxScroll, state.stepPx, state.stops, 0);
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
            state.stopIndex += 1;
            state.stepTarget = nextStepTarget(state.pos, maxScroll, state.stepPx, state.stops, state.stopIndex);
            state.pauseUntil = ts + state.stepPause;
        }

        raf = requestAnimationFrame(tick);
    }

    function start(speed, turnPause, startPause, stepPx, stepPause, stops) {
        stop();
        const { maxScroll } = getMetrics();
        if (maxScroll < 16) return false;

        const step = stepPx ?? 240;
        const midPause = stepPause ?? 480;
        const turn = turnPause ?? 650;
        const startDelay = startPause ?? 80;
        const stopList = (Array.isArray(stops) && stops.length)
            ? stops.map(v => Math.max(0, Math.min(maxScroll, Math.round(v)))).filter((y, i, arr) => i === 0 || y > arr[i - 1] + 24)
            : getScrollStops(maxScroll);

        setScroll(0);
        state = {
            pos: 0,
            maxScroll,
            resetPending: false,
            speed: speed || 170,
            turnPause: turn,
            stepPx: step,
            stepPause: midPause,
            stops: stopList,
            stopIndex: 0,
            stepTarget: nextStepTarget(0, maxScroll, step, stopList, 0),
            pauseUntil: performance.now() + startDelay,
            lastTs: performance.now()
        };
        raf = requestAnimationFrame(tick);
        return true;
    }

    function startWithRetry(speed, turnPause, startPause, stepPx, stepPause, stops, attempt) {
        if (start(speed, turnPause, startPause, stepPx, stepPause, stops)) return;
        if ((attempt || 0) >= 80) return;
        retryTimer = setTimeout(
            () => startWithRetry(speed, turnPause, startPause, stepPx, stepPause, stops, (attempt || 0) + 1),
            (attempt || 0) === 0 ? 0 : 80
        );
    }

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.type !== 'pug-embed-scroll') return;
        if (d.action === 'stop') stop();
        else if (d.action === 'start') {
            startWithRetry(d.speed, d.pause, d.startPause, d.stepPx, d.stepPause, d.stops, 0);
        } else if (d.action === 'request-ready') {
            scheduleReadyAnnounce(0);
        }
    });

    scheduleReadyAnnounce(0);
    window.addEventListener('load', () => scheduleReadyAnnounce(0));

    window.__pugEmbedScroll = { start, stop, getMetrics, publishReady, getScrollStops };
})();
