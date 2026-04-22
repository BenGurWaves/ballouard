// ═══════════════════════════════════════
// MACIEJ MIŚNIK — ROOM GALLERY ENGINE
// No scrolling. Walk between rooms.
// ═══════════════════════════════════════

(() => {
    'use strict';

    const rooms = document.querySelectorAll('.room');
    const dots  = document.querySelectorAll('.room-dot');
    const counterEl = document.querySelector('.counter-current');
    const promptEl  = document.querySelector('.room-prompt');
    const atmosphere = document.querySelector('.atmosphere');

    let current = 0;
    let locked  = false;
    const COOLDOWN = 1400;

    // ─── ROOM TRANSITIONS ───

    function goTo(index) {
        if (locked || index === current) return;
        if (index < 0 || index >= rooms.length) return;

        locked = true;
        const from = rooms[current];
        const to   = rooms[index];
        const dir  = index > current ? 1 : -1;

        // Hide prompt after first move
        if (promptEl) gsap.to(promptEl, { opacity: 0, duration: .3 });

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

        // Phase 1: Current room exits
        tl.to(fromEls, {
            y: -25 * dir,
            opacity: 0,
            stagger: 0.04,
            duration: 0.5,
            ease: 'power3.in',
        });

        // Phase 2: Brief void
        tl.to(from, {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.inOut',
        }, '-=0.15');

        // Phase 3: New room enters
        to.classList.add('active');
        tl.fromTo(to,
            { opacity: 0 },
            { opacity: 1, duration: 0.35, ease: 'power2.out' },
            '-=0.1'
        );

        tl.fromTo(toEls,
            { y: 35 * dir, opacity: 0 },
            {
                y: 0, opacity: 1,
                stagger: 0.06,
                duration: 0.65,
                ease: 'power3.out',
            },
            '-=0.15'
        );
    }

    function updateNav() {
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
        if (counterEl) counterEl.textContent = String(current + 1).padStart(2, '0');
    }

    // ─── INPUT: WHEEL ───

    let lastWheel = 0;
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheel < COOLDOWN) return;
        lastWheel = now;

        if (e.deltaY > 0) goTo(current + 1);
        else if (e.deltaY < 0) goTo(current - 1);
    }, { passive: false });

    // ─── INPUT: KEYBOARD ───

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
            e.preventDefault();
            goTo(current + 1);
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            goTo(current - 1);
        }
    });

    // ─── INPUT: TOUCH (Swipe) ───

    let touchY = 0;
    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const diff = touchY - e.changedTouches[0].clientY;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goTo(current + 1);
            else goTo(current - 1);
        }
    }, { passive: true });

    // ─── INPUT: NAV DOTS ───

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goTo(parseInt(dot.dataset.target));
        });
    });

    // ─── CURSOR ───

    const cursorDot  = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');

    if (cursorDot && cursorRing) {
        let cx = 0, cy = 0, rx = 0, ry = 0;

        document.addEventListener('mousemove', (e) => {
            cx = e.clientX;
            cy = e.clientY;

            // Atmosphere light
            if (atmosphere) {
                document.documentElement.style.setProperty('--mx', cx + 'px');
                document.documentElement.style.setProperty('--my', cy + 'px');
            }
        });

        (function tick() {
            cursorDot.style.left  = cx + 'px';
            cursorDot.style.top   = cy + 'px';
            rx += (cx - rx) * 0.1;
            ry += (cy - ry) * 0.1;
            cursorRing.style.left = rx + 'px';
            cursorRing.style.top  = ry + 'px';
            requestAnimationFrame(tick);
        })();

        // Hover states
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

        // Magnetic pull
        document.querySelectorAll('[data-magnetic]').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
            });
        });
    }

    // ─── ENTRANCE ANIMATION ───

    const firstRoom = rooms[0];
    if (firstRoom) {
        const els = firstRoom.querySelectorAll('[data-animate]');
        gsap.from(els, {
            y: 40,
            opacity: 0,
            stagger: 0.1,
            duration: 1,
            ease: 'power3.out',
            delay: 0.4,
        });
    }

})();
