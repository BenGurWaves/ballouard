// ═══════════════════════════════════════
// MACIEJ MIŚNIK — ROOM GALLERY ENGINE
// Parallax · Cursor States · Room Walk
// ═══════════════════════════════════════

(() => {
    'use strict';

    const rooms     = document.querySelectorAll('.room');
    const dots      = document.querySelectorAll('.room-dot');
    const counterEl = document.querySelector('.counter-current');
    const promptEl  = document.querySelector('.room-prompt');

    let current = 0;
    let locked  = false;
    const COOLDOWN = 1300;

    // ─── ROOM TRANSITIONS ───

    function goTo(index) {
        if (locked || index === current) return;
        if (index < 0 || index >= rooms.length) return;

        locked = true;
        const from = rooms[current];
        const to   = rooms[index];
        const dir  = index > current ? 1 : -1;

        if (promptEl && promptEl.style.opacity !== '0') {
            gsap.to(promptEl, { opacity: 0, duration: .2 });
        }

        const fromEls = from.querySelectorAll('[data-animate]');
        const toEls   = to.querySelectorAll('[data-animate]');

        // Cursor pulse during transition
        if (cursorRing) {
            gsap.to(cursorRing, { scale: 1.4, opacity: .3, duration: .3, ease: 'power2.out' });
            gsap.to(cursorRing, { scale: 1, opacity: 1, duration: .5, ease: 'power2.inOut', delay: .5 });
        }

        const tl = gsap.timeline({
            onComplete: () => {
                from.classList.remove('active');
                // Reset parallax on exited room
                from.querySelectorAll('[data-depth]').forEach(el => {
                    gsap.set(el, { x: 0, y: 0 });
                });
                current = index;
                locked = false;
                updateNav();
            }
        });

        // Exit
        tl.to(fromEls, {
            y: -18 * dir,
            opacity: 0,
            stagger: 0.03,
            duration: 0.4,
            ease: 'power3.in',
        });

        tl.to(from, {
            opacity: 0,
            duration: 0.2,
            ease: 'power2.inOut',
        }, '-=0.1');

        // Enter
        to.classList.add('active');
        tl.fromTo(to,
            { opacity: 0 },
            { opacity: 1, duration: 0.25, ease: 'power2.out' },
            '-=0.05'
        );

        tl.fromTo(toEls,
            { y: 28 * dir, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.05, duration: 0.55, ease: 'power3.out' },
            '-=0.1'
        );
    }

    function updateNav() {
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
        if (counterEl) counterEl.textContent = String(current + 1).padStart(2, '0');
    }

    // ─── INPUT: WHEEL ───

    let lastWheel = 0;
    let wheelAccum = 0;

    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheel < COOLDOWN || locked) return;

        wheelAccum += e.deltaY;
        if (Math.abs(wheelAccum) >= 35) {
            lastWheel = now;
            if (wheelAccum > 0) goTo(current + 1);
            else goTo(current - 1);
            wheelAccum = 0;
        }
    }, { passive: false });

    let wheelTimer;
    window.addEventListener('wheel', () => {
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { wheelAccum = 0; }, 120);
    }, { passive: true });

    // ─── INPUT: KEYBOARD ───

    window.addEventListener('keydown', (e) => {
        if (['ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); goTo(current + 1); }
        if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(current - 1); }
    });

    // ─── INPUT: TOUCH ───

    let touchY = 0, touchTime = 0;

    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
        touchTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const diff = touchY - e.changedTouches[0].clientY;
        const fast = Date.now() - touchTime < 200;
        if (Math.abs(diff) > (fast ? 25 : 45)) {
            if (diff > 0) goTo(current + 1);
            else goTo(current - 1);
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    // ─── NAV DOTS ───

    dots.forEach(dot => {
        dot.addEventListener('click', () => goTo(parseInt(dot.dataset.target)));
    });

    // ─── CURSOR SYSTEM ───

    const cursorDot  = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    const isTouch = !window.matchMedia('(hover: hover)').matches;

    let cx = 0, cy = 0, rx = 0, ry = 0;

    if (!isTouch && cursorDot && cursorRing) {

        document.addEventListener('mousemove', (e) => {
            cx = e.clientX;
            cy = e.clientY;
            document.documentElement.style.setProperty('--mx', cx + 'px');
            document.documentElement.style.setProperty('--my', cy + 'px');
        });

        // Animation frame: cursor + parallax
        (function tick() {
            cursorDot.style.left = cx + 'px';
            cursorDot.style.top  = cy + 'px';
            rx += (cx - rx) * 0.16;
            ry += (cy - ry) * 0.16;
            cursorRing.style.left = rx + 'px';
            cursorRing.style.top  = ry + 'px';

            // Mouse parallax on active room
            const activeRoom = rooms[current];
            if (activeRoom) {
                const nx = (cx / window.innerWidth - 0.5) * 2;
                const ny = (cy / window.innerHeight - 0.5) * 2;
                activeRoom.querySelectorAll('[data-depth]').forEach(el => {
                    const d = parseFloat(el.dataset.depth);
                    const tx = nx * d * -14;
                    const ty = ny * d * -10;
                    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
                });
            }

            requestAnimationFrame(tick);
        })();

        // ── Cursor states ──

        // Links & buttons
        document.querySelectorAll('a, button, [data-magnetic]').forEach(el => {
            el.addEventListener('mouseenter', () => { setCS('on-link'); });
            el.addEventListener('mouseleave', () => { clearCS(); });
        });

        // Headings
        document.querySelectorAll('h1, h2, .room-title, .threshold-name').forEach(el => {
            el.addEventListener('mouseenter', () => { setCS('on-heading'); });
            el.addEventListener('mouseleave', () => { clearCS(); });
        });

        // Ghost text
        document.querySelectorAll('.ghost-text, .cl-ghost').forEach(el => {
            el.addEventListener('mouseenter', () => { setCS('on-ghost'); });
            el.addEventListener('mouseleave', () => { clearCS(); });
        });

        // Data values
        document.querySelectorAll('.data-val').forEach(el => {
            el.addEventListener('mouseenter', () => { setCS('on-data'); });
            el.addEventListener('mouseleave', () => { clearCS(); });
        });

        function setCS(cls) {
            cursorDot.className = 'cursor-dot ' + cls;
            cursorRing.className = 'cursor-ring ' + cls;
        }
        function clearCS() {
            cursorDot.className = 'cursor-dot';
            cursorRing.className = 'cursor-ring';
        }

        // Click
        document.addEventListener('mousedown', () => {
            gsap.to(cursorRing, { scale: 0.75, duration: 0.12, ease: 'power2.in' });
        });
        document.addEventListener('mouseup', () => {
            gsap.to(cursorRing, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
        });

        // Magnetic
        document.querySelectorAll('[data-magnetic]').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                gsap.to(el, {
                    x: (e.clientX - r.left - r.width / 2) * 0.3,
                    y: (e.clientY - r.top - r.height / 2) * 0.3,
                    duration: 0.2, ease: 'power2.out',
                });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' });
            });
        });

    } else {
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
    }

    // ─── ENTRANCE ANIMATION ───

    const first = rooms[0];
    if (first) {
        const els = first.querySelectorAll('[data-animate]');
        gsap.set(els, { y: 35, opacity: 0 });
        gsap.to(els, {
            y: 0, opacity: 1,
            stagger: 0.12, duration: 1.2,
            ease: 'power3.out', delay: 0.25,
        });
    }

})();
