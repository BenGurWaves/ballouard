// Initialize Lenis Smooth Scroll
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

// GSAP Animations
gsap.registerPlugin(ScrollTrigger);

// Custom Cursor
const cursor = document.querySelector('.custom-cursor');
document.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: 'none'
    });
});

// Hover effects for cursor
const links = document.querySelectorAll('a, .btn-magnetic');
links.forEach(link => {
    link.addEventListener('mouseenter', () => {
        gsap.to(cursor, {
            scale: 4,
            backgroundColor: 'rgba(166, 137, 102, 0.2)',
            backdropFilter: 'blur(5px)'
        });
    });
    link.addEventListener('mouseleave', () => {
        gsap.to(cursor, {
            scale: 1,
            backgroundColor: '#a68966',
            backdropFilter: 'none'
        });
    });
});

// Hero Animation
gsap.from('.hero-title', {
    y: 100,
    opacity: 0,
    duration: 1.5,
    ease: 'power4.out',
    delay: 0.5
});

gsap.from('.hero-subtitle', {
    y: 20,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    delay: 0.2
});

gsap.from('.hero-desc', {
    opacity: 0,
    duration: 2,
    delay: 1
});

// Reveal Sections
const revealElements = document.querySelectorAll('.story-section, .quote-section');
revealElements.forEach(el => {
    gsap.from(el, {
        scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    });
});

// Image Parallax
const images = document.querySelectorAll('.story-image img');
images.forEach(img => {
    gsap.to(img, {
        scrollTrigger: {
            trigger: img,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
        },
        y: -50,
        ease: 'none'
    });
});

// Magnetic Button Effect
const btn = document.querySelector('.btn-magnetic');
if (btn) {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(btn, {
            x: x * 0.3,
            y: y * 0.3,
            duration: 0.3,
            ease: 'power2.out'
        });
    });

    btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: 'elastic.out(1, 0.3)'
        });
    });
}
