// ═══════════════════════════════════════
// MACIEJ MIŚNIK — ARCHIVAL EXPERIENCE
// Motion Engine & Visual Atmosphere
// ═══════════════════════════════════════

(() => {
    'use strict';

    // ─── LENIS: HEAVY INERTIAL SCROLL ───
    const lenis = new Lenis({
        duration: 1.8,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 0.7,
        smoothTouch: false,
        touchMultiplier: 1.5,
        infinite: false,
    });

    // Sync Lenis → GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // ─── THREE.JS: THE VOID ───
    const canvas = document.getElementById('void');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.07);

    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a);

    // Particle Field
    const PARTICLE_COUNT = 2500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
        randoms[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    const vertexShader = `
        attribute float aRandom;
        uniform float uTime;
        uniform vec2 uMouse;
        varying float vAlpha;
        varying float vRandom;

        void main() {
            vec3 pos = position;

            // Slow organic drift
            pos.x += sin(uTime * 0.1 + position.z * 0.5) * 0.3;
            pos.y += cos(uTime * 0.08 + position.x * 0.3) * 0.4;
            pos.z += sin(uTime * 0.06 + position.y * 0.4) * 0.2;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

            // Size: depth-dependent
            float size = aRandom * 3.0 + 1.0;
            size *= (1.0 / -mvPosition.z) * 8.0;

            gl_PointSize = size;
            gl_Position = projectionMatrix * mvPosition;

            // Alpha: depth fade
            float depth = smoothstep(-15.0, -1.0, mvPosition.z);
            vAlpha = depth * (aRandom * 0.5 + 0.5);
            vRandom = aRandom;
        }
    `;

    const fragmentShader = `
        varying float vAlpha;
        varying float vRandom;

        void main() {
            // Soft circular point
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;

            float alpha = smoothstep(0.5, 0.1, dist) * vAlpha * 0.5;

            // Color: warm white base, emerald and bronze accents
            vec3 warmWhite = vec3(0.83, 0.82, 0.78);
            vec3 emerald   = vec3(0.016, 0.14, 0.09);
            vec3 bronze    = vec3(0.65, 0.49, 0.3);

            vec3 color = mix(warmWhite, emerald, step(0.7, vRandom));
            color = mix(color, bronze, step(0.92, vRandom));

            gl_FragColor = vec4(color, alpha);
        }
    `;

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime:  { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse tracking
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // Scroll state
    let scrollY = 0;
    lenis.on('scroll', ({ scroll }) => { scrollY = scroll; });

    // Render loop
    function animate() {
        material.uniforms.uTime.value += 0.008;
        material.uniforms.uMouse.value.set(mouse.x, mouse.y);

        // Slow camera drift following mouse
        camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.015;
        camera.position.y += (mouse.y * 0.25 - camera.position.y) * 0.015;

        // Scroll-based particle rotation
        particles.rotation.y = scrollY * 0.00008;
        particles.rotation.x = scrollY * 0.00004;

        camera.lookAt(scene.position);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ─── CURSOR SYSTEM ───
    const dot  = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');

    if (dot && ring) {
        let cx = 0, cy = 0;
        let rx = 0, ry = 0;

        document.addEventListener('mousemove', (e) => {
            cx = e.clientX;
            cy = e.clientY;
        });

        function updateCursor() {
            dot.style.left = cx + 'px';
            dot.style.top  = cy + 'px';

            rx += (cx - rx) * 0.1;
            ry += (cy - ry) * 0.1;
            ring.style.left = rx + 'px';
            ring.style.top  = ry + 'px';

            requestAnimationFrame(updateCursor);
        }
        updateCursor();

        // Hover expansion
        const interactives = document.querySelectorAll('a, [data-magnetic]');
        interactives.forEach(el => {
            el.addEventListener('mouseenter', () => {
                dot.classList.add('active');
                ring.classList.add('active');
            });
            el.addEventListener('mouseleave', () => {
                dot.classList.remove('active');
                ring.classList.remove('active');
            });
        });

        // Magnetic pull
        document.querySelectorAll('[data-magnetic]').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(el, {
                    x: x * 0.35,
                    y: y * 0.35,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(el, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: 'elastic.out(1, 0.3)',
                });
            });
        });
    }

    // ─── GSAP: THRESHOLD ENTRANCE ───
    const nameEl = document.querySelector('.threshold-name');
    if (nameEl) {
        const raw = nameEl.textContent.trim();
        nameEl.innerHTML = '';

        raw.split('').forEach(char => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.display = 'inline-block';
            nameEl.appendChild(span);
        });

        gsap.from(nameEl.querySelectorAll('.char'), {
            y: 140,
            opacity: 0,
            rotationX: 80,
            stagger: 0.035,
            duration: 1.6,
            ease: 'power4.out',
            delay: 0.4,
        });
    }

    gsap.from('.threshold-meta .classification', {
        y: 20,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        ease: 'power3.out',
        delay: 0.1,
    });

    gsap.from('.threshold-axiom', {
        opacity: 0,
        duration: 1.5,
        delay: 1.4,
    });

    gsap.from('.axiom-line', {
        scaleX: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        delay: 1.6,
    });

    gsap.from('.threshold-coords .classification', {
        opacity: 0,
        y: 10,
        stagger: 0.15,
        duration: 1,
        delay: 1.8,
    });

    gsap.from('.scroll-ritual', {
        opacity: 0,
        duration: 2,
        delay: 2.5,
    });

    // ─── GSAP: DOSSIER HORIZONTAL SCROLL ───
    const dossierSection = document.querySelector('.dossier');
    const dossierTrack   = document.querySelector('.dossier-track');

    if (dossierSection && dossierTrack) {
        const getScrollWidth = () => dossierTrack.scrollWidth - window.innerWidth + 200;

        gsap.to(dossierTrack, {
            x: () => -getScrollWidth(),
            ease: 'none',
            scrollTrigger: {
                trigger: dossierSection,
                start: 'top top',
                end: () => '+=' + getScrollWidth(),
                pin: true,
                scrub: 1.2,
                invalidateOnRefresh: true,
            },
        });
    }

    // ─── GSAP: SPECIMEN REVEAL ───
    gsap.from('.specimen-frame', {
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: 1.6,
        ease: 'power4.inOut',
        scrollTrigger: {
            trigger: '.specimen',
            start: 'top 65%',
            toggleActions: 'play none none reverse',
        },
    });

    gsap.from('.specimen-data', {
        x: 80,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.specimen',
            start: 'top 55%',
            toggleActions: 'play none none reverse',
        },
    });

    gsap.from('.data-cell', {
        y: 30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.data-grid',
            start: 'top 75%',
            toggleActions: 'play none none reverse',
        },
    });

    // ─── GSAP: CHRONOMETER REVEAL ───
    gsap.from('.chronometer-text', {
        x: -60,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.chronometer',
            start: 'top 65%',
            toggleActions: 'play none none reverse',
        },
    });

    gsap.from('.chronometer-frame', {
        clipPath: 'inset(0% 100% 0% 0%)',
        duration: 1.6,
        ease: 'power4.inOut',
        scrollTrigger: {
            trigger: '.chronometer',
            start: 'top 55%',
            toggleActions: 'play none none reverse',
        },
    });

    // ─── GSAP: TESTAMENT ───
    gsap.from('.testament-mark', {
        scale: 0.4,
        opacity: 0,
        duration: 1.5,
        ease: 'power2.out',
        scrollTrigger: {
            trigger: '.testament',
            start: 'top 70%',
            toggleActions: 'play none none reverse',
        },
    });

    gsap.from('.testament-quote', {
        y: 60,
        opacity: 0,
        duration: 1.5,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.testament',
            start: 'top 60%',
            toggleActions: 'play none none reverse',
        },
    });

    gsap.from('.testament-cite', {
        opacity: 0,
        duration: 1.2,
        scrollTrigger: {
            trigger: '.testament',
            start: 'top 50%',
            toggleActions: 'play none none reverse',
        },
    });

    // ─── GSAP: IMAGE PARALLAX ───
    document.querySelectorAll('.specimen-frame img, .chronometer-frame img').forEach(img => {
        gsap.to(img, {
            y: -40,
            ease: 'none',
            scrollTrigger: {
                trigger: img.closest('.chamber'),
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            },
        });
    });

    // ─── GSAP: COLOPHON ───
    gsap.from('.colophon-cell', {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.colophon',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
        },
    });

})();
