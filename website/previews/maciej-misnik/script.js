// ═══════════════════════════════════════
// MACIEJ MIŚNIK — KINETIC GSAP ENGINE
// Abstract, Imageless, Scroll-bound Timeline
// ═══════════════════════════════════════

(() => {
    'use strict';

    gsap.registerPlugin(ScrollTrigger);

    // ─── INIT LENIS (SMOOTH SCROLL) ───
    // This handles the native scrolling over the #scroll-proxy div
    const lenis = new Lenis({
        duration: 2.0, // Extremely smooth and heavy
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        mouseMultiplier: 1.0,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // ─── MASTER KINETIC TIMELINE ───
    // We bind a single massive timeline to the scroll proxy
    const proxy = document.getElementById('scroll-proxy');
    
    // Select elements
    const geo = document.getElementById('geo');
    const introChars = document.querySelectorAll('.char-span');
    const layerThesis = document.querySelector('#layer-thesis .thesis-text');
    
    const layerData = document.getElementById('layer-data');
    const orbits = document.querySelectorAll('.data-orbit');
    const coreText = document.querySelector('.center-core');
    
    const layerLegacy = document.querySelector('#layer-legacy .thesis-text');
    const layerOutro = document.querySelector('.outro-content');

    // Setup initial states
    gsap.set(geo, { rotationX: 45, rotationY: -15, scale: 0.8 });
    gsap.set(introChars, { z: 0, opacity: 1 });
    gsap.set(layerThesis, { opacity: 0, scale: 0.8, y: 100 });
    gsap.set(layerData, { opacity: 0 });
    
    // Set up orbits
    orbits.forEach((orbit, i) => {
        const radius = window.innerWidth < 768 ? 120 : 250;
        const angle = (i / orbits.length) * Math.PI * 2;
        gsap.set(orbit.querySelector('.mono'), { 
            x: Math.cos(angle) * radius, 
            y: Math.sin(angle) * radius 
        });
    });

    gsap.set(layerLegacy, { opacity: 0, scale: 0.8, x: 100 });
    gsap.set(layerOutro, { opacity: 0, y: 50 });

    // Build the scrub timeline
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: proxy,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.5, // 1.5 seconds of smoothing on the scrub
        }
    });

    // --- PHASE 1: SCATTER THE INTRO & ROTATE GEO ---
    tl.to(geo, { rotationX: 0, rotationY: 0, rotationZ: 180, scale: 1.2, ease: "none", duration: 10 }, 0);
    
    introChars.forEach((char, i) => {
        // Randomly scatter each character in Z space
        const zDest = (Math.random() * 1500) + 500;
        const xDest = (Math.random() - 0.5) * 1000;
        const yDest = (Math.random() - 0.5) * 1000;
        const rot = (Math.random() - 0.5) * 180;
        
        tl.to(char, {
            z: zDest,
            x: xDest,
            y: yDest,
            rotation: rot,
            opacity: 0,
            ease: "power2.in",
            duration: 2 + (Math.random() * 2)
        }, 0);
    });

    // --- PHASE 2: THESIS APPEARS ---
    tl.to(layerThesis, { opacity: 1, scale: 1, y: 0, duration: 2, ease: "power2.out" }, 1.5);
    tl.to(layerThesis, { opacity: 0, scale: 1.2, y: -100, duration: 2, ease: "power2.in" }, 4.5);

    // --- PHASE 3: DATA ORBITS & CORE ---
    tl.to(geo, { rotationZ: 360, scale: 0.5, duration: 5, ease: "none" }, 5);
    tl.to(layerData, { opacity: 1, duration: 1 }, 5);
    tl.to(coreText, { opacity: 1, scale: 1, duration: 2, ease: "power2.out" }, 5);
    
    orbits.forEach((orbit, i) => {
        tl.to(orbit, { rotation: 360, duration: 4, ease: "none" }, 5);
        // Counter-rotate the text inside so it stays upright
        tl.to(orbit.querySelector('.mono'), { rotation: -360, duration: 4, ease: "none" }, 5);
    });

    tl.to(layerData, { opacity: 0, scale: 2, duration: 1.5, ease: "power2.in" }, 8.5);

    // --- PHASE 4: LEGACY ---
    tl.to(layerLegacy, { opacity: 1, scale: 1, x: 0, duration: 2, ease: "power2.out" }, 9);
    tl.to(layerLegacy, { opacity: 0, scale: 0.8, x: -100, duration: 2, ease: "power2.in" }, 12);

    // --- PHASE 5: OUTRO & GEOMETRY COLLAPSE ---
    tl.to(geo, { scale: 0, opacity: 0, duration: 2, ease: "power3.in" }, 12);
    tl.to(layerOutro, { opacity: 1, y: 0, duration: 2, ease: "power2.out" }, 13);


    // ─── CURSOR ENGINE ───
    const cursorDot  = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    const isTouch = !window.matchMedia('(hover: hover)').matches;

    let tX = window.innerWidth / 2, tY = window.innerHeight / 2;
    let cX = tX, cY = tY, rX = tX, rY = tY;

    if (!isTouch && cursorDot && cursorRing) {
        document.addEventListener('mousemove', (e) => { tX = e.clientX; tY = e.clientY; });

        (function tick() {
            cX += (tX - cX) * 0.25; cY += (tY - cY) * 0.25;
            cursorDot.style.transform = `translate(${cX}px, ${cY}px) translate(-50%, -50%)`;
            
            rX += (tX - rX) * 0.15; rY += (tY - rY) * 0.15;
            cursorRing.style.transform = `translate(${rX}px, ${rY}px) translate(-50%, -50%)`;

            requestAnimationFrame(tick);
        })();

        // Hover states
        document.querySelectorAll('a').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorRing.style.width = '80px';
                cursorRing.style.height = '80px';
                cursorRing.style.backgroundColor = 'rgba(195, 155, 107, 0.1)';
            });
            el.addEventListener('mouseleave', () => {
                cursorRing.style.width = '36px';
                cursorRing.style.height = '36px';
                cursorRing.style.backgroundColor = 'transparent';
            });
        });
    }

})();
