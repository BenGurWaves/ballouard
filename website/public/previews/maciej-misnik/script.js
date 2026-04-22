// ═══════════════════════════════════════
// MACIEJ MIŚNIK — ROOM GALLERY ENGINE
// No scrolling. Walk between rooms.
// ═══════════════════════════════════════

(() => {
    'use strict';

    const rooms     = document.querySelectorAll('.room');
    const dots      = document.querySelectorAll('.room-dot');
    const counterEl = document.querySelector('.counter-current');
    const promptEl  = document.querySelector('.room-prompt');
    const atmosphere = document.querySelector('.atmosphere');

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

        // Hide scroll prompt permanently
        if (promptEl && promptEl.style.opacity !== '0') {
            gsap.to(promptEl, { opacity: 0, duration: .25 });
        }

        const fromEls = from.querySelectorAll('[data-animate]');
        const toEls   = to.querySelectorAll('[data-animate]');

        const tl = gsap.timeline({
            onComplete: () => {
                from.classList.remove('active');
                current = index;
                locked = false;
                updateNav();
            }
        });

        // Exit: content floats away
        tl.to(fromEls, {
            y: -20 * dir,
            opacity: 0,
            stagger: 0.035,
            duration: 0.45,
            ease: 'power3.in',
        });

        // Fade room out
        tl.to(from, {
            opacity: 0,
            duration: 0.25,
            ease: 'power2.inOut',
        }, '-=0.12');

        // Bring new room in
        to.classList.add('active');
        tl.fromTo(to,
            { opacity: 0 },
            { opacity: 1, duration: 0.3, ease: 'power2.out' },
            '-=0.08'
        );

        // Content materializes
        tl.fromTo(toEls,
            { y: 30 * dir, opacity: 0 },
            {
                y: 0, opacity: 1,
                stagger: 0.055,
                duration: 0.6,
                ease: 'power3.out',
            },
            '-=0.12'
        );
    }

    function updateNav() {
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
        if (counterEl) counterEl.textContent = String(current + 1).padStart(2, '0');
    }

    // ─── INPUT: WHEEL (debounced) ───

    let lastWheel = 0;
    let wheelAccum = 0;
    const WHEEL_THRESHOLD = 40;

    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheel < COOLDOWN || locked) return;

        wheelAccum += e.deltaY;
        if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
            lastWheel = now;
            if (wheelAccum > 0) goTo(current + 1);
            else goTo(current - 1);
            wheelAccum = 0;
        }
    }, { passive: false });

    // Reset accumulator after pause
    let wheelTimer;
    window.addEventListener('wheel', () => {
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { wheelAccum = 0; }, 150);
    }, { passive: true });

    // ─── INPUT: KEYBOARD ───

    window.addEventListener('keydown', (e) => {
        if (['ArrowDown', ' ', 'PageDown'].includes(e.key)) {
            e.preventDefault(); goTo(current + 1);
        }
        if (['ArrowUp', 'PageUp'].includes(e.key)) {
            e.preventDefault(); goTo(current - 1);
        }
    });

    // ─── INPUT: TOUCH (swipe with velocity) ───

    let touchY = 0;
    let touchTime = 0;

    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
        touchTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const diff = touchY - e.changedTouches[0].clientY;
        const elapsed = Date.now() - touchTime;
        // Accept shorter swipes if they're fast
        const threshold = elapsed < 200 ? 30 : 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) goTo(current + 1);
            else goTo(current - 1);
        }
    }, { passive: true });

    // Prevent pull-to-refresh
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    // ─── INPUT: NAV DOTS ───

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goTo(parseInt(dot.dataset.target));
        });
    });

    // ─── CURSOR SYSTEM ───

    const cursorDot  = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');

    if (cursorDot && cursorRing && window.matchMedia('(hover: hover)').matches) {
        let cx = 0, cy = 0, rx = 0, ry = 0;

        document.addEventListener('mousemove', (e) => {
            cx = e.clientX;
            cy = e.clientY;

            // Update atmosphere light position
            document.documentElement.style.setProperty('--mx', cx + 'px');
            document.documentElement.style.setProperty('--my', cy + 'px');
        });

        (function tick() {
            // Dot: instant
            cursorDot.style.left = cx + 'px';
            cursorDot.style.top  = cy + 'px';

            // Ring: follows with tighter lag (0.14 instead of 0.1)
            rx += (cx - rx) * 0.14;
            ry += (cy - ry) * 0.14;
            cursorRing.style.left = rx + 'px';
            cursorRing.style.top  = ry + 'px';

            requestAnimationFrame(tick);
        })();

        // Hover expansion
        document.querySelectorAll('a, button, [data-magnetic]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorDot.classList.add('hover');
                cursorRing.classList.add('hover');
            });
            el.addEventListener('mouseleave', () => {
                cursorDot.classList.remove('hover');
                cursorRing.classList.remove('hover');
            });
        });

        // Click pulse
        document.addEventListener('mousedown', () => {
            gsap.to(cursorRing, {
                scale: 0.8,
                duration: 0.15,
                ease: 'power2.in'
            });
        });
        document.addEventListener('mouseup', () => {
            gsap.to(cursorRing, {
                scale: 1,
                duration: 0.4,
                ease: 'elastic.out(1, 0.4)'
            });
        });

        // Magnetic pull
        document.querySelectorAll('[data-magnetic]').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.25, ease: 'power2.out' });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
            });
        });
    } else {
        // Touch device: hide cursor elements
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
    }

    // ─── ENTRANCE ANIMATION ───

    const firstRoom = rooms[0];
    if (firstRoom) {
        const els = firstRoom.querySelectorAll('[data-animate]');
        gsap.set(els, { y: 40, opacity: 0 });

        gsap.to(els, {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 1.1,
            ease: 'power3.out',
            delay: 0.3,
        });
    }

})();
