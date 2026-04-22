// ═══════════════════════════════════════
// MACIEJ MIŚNIK — HIGH-END ATELIER
// GSAP Choreography, Fluid Canvas, Cursor Engine
// ═══════════════════════════════════════

(() => {
    'use strict';

    gsap.registerPlugin(SplitText);

    const rooms     = document.querySelectorAll('.room');
    const dots      = document.querySelectorAll('.room-dot');
    const counterEl = document.querySelector('.counter-current');

    let current = 0;
    let locked  = false;
    const COOLDOWN = 1600; // Slower, more deliberate transitions

    // ─── AMBIENT FLUID BACKGROUND ───
    const canvas = document.getElementById('fluid-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        });

        const particles = [];
        const numParticles = 25; // Massive, slow moving gradients

        function initParticles() {
            particles.length = 0;
            for(let i=0; i<numParticles; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.15,
                    vy: (Math.random() - 0.5) * 0.15,
                    size: Math.random() * (width * 0.6) + (width * 0.3),
                    colorStart: [195, 155, 107, Math.random() * 0.015 + 0.005]
                });
            }
        }
        initParticles();

        function drawFluid() {
            ctx.clearRect(0, 0, width, height);
            
            for(let p of particles) {
                p.x += p.vx;
                p.y += p.vy;

                // Bounce
                if (p.x < -p.size) p.vx *= -1;
                if (p.x > width + p.size) p.vx *= -1;
                if (p.y < -p.size) p.vy *= -1;
                if (p.y > height + p.size) p.vy *= -1;

                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                grad.addColorStop(0, `rgba(${p.colorStart[0]}, ${p.colorStart[1]}, ${p.colorStart[2]}, ${p.colorStart[3]})`);
                grad.addColorStop(1, `rgba(10, 10, 9, 0)`);
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(drawFluid);
        }
        drawFluid();
    }

    // ─── SPLIT TEXT PREP ───
    const splitElements = document.querySelectorAll('[data-split]');
    const splits = [];
    splitElements.forEach(el => {
        const tr = new SplitText(el, { type: "chars, words" });
        splits.push(tr);
        gsap.set(tr.chars, { y: 150, opacity: 0 }); // Intial state
    });

    // ─── ROOM TRANSITIONS ───
    function goTo(index) {
        if (locked || index === current) return;
        if (index < 0 || index >= rooms.length) return;

        locked = true;
        const from = rooms[current];
        const to   = rooms[index];
        const dir  = index > current ? 1 : -1;

        // Reset text
        if(cursorText) cursorText.style.opacity = 0;

        const fromAnimates = from.querySelectorAll('[data-animate]');
        const toAnimates   = to.querySelectorAll('[data-animate]');
        const toSplits = Array.from(to.querySelectorAll('[data-split]')).map(el => {
            return splits.find(s => s.elements[0] === el).chars;
        });

        // Flash Ring
        if (cursorRing) {
            gsap.to(cursorRing, { scale: 1.5, opacity: 0.1, duration: 0.5, ease: 'power2.out' });
            gsap.to(cursorRing, { scale: 1, opacity: 1, duration: 0.7, ease: 'power2.inOut', delay: 0.5 });
        }

        const tl = gsap.timeline({
            onComplete: () => {
                from.classList.remove('active');
                current = index;
                locked = false;
                updateNav();
            }
        });

        // Exit Out
        tl.to(fromAnimates, {
            y: -40 * dir,
            opacity: 0,
            stagger: 0.05,
            duration: 0.8,
            ease: "power4.inOut"
        });

        tl.to(from, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, "-=0.4");

        // Enter In
        to.classList.add('active');
        tl.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.2");

        tl.fromTo(toAnimates, 
            { y: 60 * dir, opacity: 0 }, 
            { y: 0, opacity: 1, stagger: 0.1, duration: 1.2, ease: "expo.out" }, 
            "-=0.3"
        );

        // Split Text Reveal
        if(toSplits.length > 0) {
            tl.to(toSplits, {
                y: 0,
                opacity: 1,
                stagger: 0.02,
                duration: 1.2,
                ease: "expo.out"
            }, "-=1.2");
        }
    }

    function updateNav() {
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
        if (counterEl) counterEl.textContent = String(current + 1).padStart(2, '0');
        
        // Fluid Color Morphing
        if (particles && particles.length > 0) {
            const colors = [
                [195, 155, 107], // 0: Bronze
                [210, 180, 140], // 1: Pale
                [160, 120, 80],  // 2: Deep
                [180, 140, 100], // 3: Mid
                [220, 200, 180], // 4: White/gold
                [150, 110, 70],  // 5: Dark
            ];
            const c = colors[current] || colors[0];
            particles.forEach(p => {
                gsap.to(p.colorStart, { 0: c[0], 1: c[1], 2: c[2], duration: 2.5, ease: "power2.out" });
            });
        }
    }

    // ─── INPUT ENGINE ───
    let lastWheel = 0, wheelAccum = 0;
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheel < COOLDOWN || locked) return;

        wheelAccum += e.deltaY;
        if (Math.abs(wheelAccum) >= 50) {
            lastWheel = now;
            if (wheelAccum > 0) goTo(current + 1);
            else goTo(current - 1);
            wheelAccum = 0;
        }
    }, { passive: false });

    let wheelTimer;
    window.addEventListener('wheel', () => {
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { wheelAccum = 0; }, 150);
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
        if (['ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); goTo(current + 1); }
        if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(current - 1); }
    });

    let touchY = 0, touchTime = 0;
    window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchTime = Date.now(); }, { passive: true });
    window.addEventListener('touchend', (e) => {
        const diff = touchY - e.changedTouches[0].clientY;
        const fast = Date.now() - touchTime < 250;
        if (Math.abs(diff) > (fast ? 40 : 80)) { diff > 0 ? goTo(current + 1) : goTo(current - 1); }
    }, { passive: true });
    document.addEventListener('touchmove', (e) => { if (e.touches.length === 1) e.preventDefault(); }, { passive: false });

    dots.forEach(dot => dot.addEventListener('click', () => goTo(parseInt(dot.dataset.target))));

    // ─── CURSOR & PARALLAX ───
    const cursorDot  = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    const cursorText = document.querySelector('.cursor-text');
    const isTouch = !window.matchMedia('(hover: hover)').matches;

    let tX = window.innerWidth / 2, tY = window.innerHeight / 2;
    let cX = tX, cY = tY, rX = tX, rY = tY;

    if (!isTouch && cursorDot && cursorRing) {
        document.addEventListener('mousemove', (e) => { tX = e.clientX; tY = e.clientY; });

        (function tick() {
            cX += (tX - cX) * 0.25; cY += (tY - cY) * 0.25;
            cursorDot.style.transform = `translate(${cX}px, ${cY}px) translate(-50%, -50%)`;
            
            rX += (tX - rX) * 0.12; rY += (tY - rY) * 0.12;
            cursorRing.style.transform = `translate(${rX}px, ${rY}px) translate(-50%, -50%)`;
            if(cursorText) cursorText.style.transform = `translate(${rX}px, ${rY}px) translate(-50%, -50%)`;

            // Parallax on current room only
            const activeRoom = rooms[current];
            if (activeRoom) {
                const nx = (cX / window.innerWidth - 0.5) * 2;
                const ny = (cY / window.innerHeight - 0.5) * 2;
                
                activeRoom.querySelectorAll('[data-depth]').forEach(el => {
                    const d = parseFloat(el.dataset.depth || 0);
                    // Add subtle rotation to media blocks
                    if (el.classList.contains('media-block') || el.classList.contains('hero-media')) {
                        const rX = ny * d * 15;
                        const rY = nx * d * -15;
                        el.style.transform = `translate3d(${nx * d * -30}px, ${ny * d * -20}px, 0) rotateX(${rX}deg) rotateY(${rY}deg)`;
                    } else {
                        el.style.transform = `translate3d(${nx * d * -25}px, ${ny * d * -15}px, 0)`;
                    }
                });
            }
            requestAnimationFrame(tick);
        })();

        // Hover States
        document.querySelectorAll('a, button, [data-magnetic]').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });

        // Media Data-Cursor Hover
        document.querySelectorAll('[data-cursor]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                document.body.classList.add('cursor-media');
                if(cursorText) {
                    cursorText.innerText = el.dataset.cursor;
                    cursorText.classList.add('cursor-media-text');
                }
            });
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-media');
                if(cursorText) cursorText.classList.remove('cursor-media-text');
            });
        });

        document.addEventListener('mousedown', () => gsap.to(cursorRing, { scale: 0.7, duration: 0.15 }));
        document.addEventListener('mouseup', () => gsap.to(cursorRing, { scale: 1, duration: 0.4, ease: 'elastic.out' }));
    } else {
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
    }

    // ─── INFINITE MARQUEE ───
    const marquee = document.querySelector('.press-marquee');
    if (marquee) {
        gsap.to(marquee, { xPercent: -50, repeat: -1, duration: 25, ease: "none" });
    }

    // ─── INITIALIZE INTRO ───
    const first = rooms[0];
    if (first) {
        const els = first.querySelectorAll('[data-animate]');
        const sPl = splits.filter(s => first.contains(s.elements[0]));
        
        gsap.set(els, { y: 60, opacity: 0 });
        gsap.to(els, { y: 0, opacity: 1, stagger: 0.1, duration: 1.8, ease: "expo.out", delay: 0.3 });
        
        sPl.forEach(sp => {
            gsap.to(sp.chars, { y: 0, opacity: 1, stagger: 0.03, duration: 1.5, ease: "expo.out", delay: 0.4 });
        });
    }

})();
