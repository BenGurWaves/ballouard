// ========================================
// Ballouard — GSAP Animation Architecture
// Heavy, Mechanical, Precise
// ========================================

gsap.registerPlugin(ScrollTrigger);

// ========================================
// Configuration
// ========================================

const EASE_LUXURY = 'power4.inOut';
const EASE_HEAVY = 'power3.inOut';
const DURATION_SLOW = 2;
const DURATION_MEDIUM = 1.5;
const DURATION_MICRO = 0.8;
const STAGGER_DELAY = 0.08;

// Scroll velocity clamping
const MAX_SCROLL_IMPACT = 0.15;
const SCROLL_SMOOTHING = 0.1;

// ========================================
// Loading Sequence
// ========================================

const loadingTimeline = gsap.timeline({
    onComplete: () => {
        document.getElementById('loader').style.pointerEvents = 'none';
        initScrollAnimations();
    }
});

// Loader entrance — slow, deliberate
loadingTimeline
    .from('.loader__mark', {
        scale: 0,
        rotation: -180,
        duration: DURATION_SLOW,
        ease: EASE_LUXURY
    })
    .from('.loader__glyph', {
        opacity: 0,
        y: 20,
        duration: DURATION_MEDIUM,
        ease: EASE_HEAVY
    }, '-=1.2')
    .from('.loader__line', {
        scaleY: 0,
        transformOrigin: 'top',
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    }, '-=0.8')
    // Brief pause to establish presence
    .to({}, { duration: 0.6 })
    // Exit sequence
    .to('.loader__line', {
        scaleY: 0,
        transformOrigin: 'bottom',
        duration: DURATION_MICRO,
        ease: EASE_LUXURY
    })
    .to('.loader__glyph', {
        opacity: 0,
        y: -10,
        duration: DURATION_MICRO,
        ease: EASE_HEAVY
    }, '-=0.4')
    .to('.loader__mark', {
        scale: 1.5,
        opacity: 0,
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    }, '-=0.6')
    .to('.loader', {
        opacity: 0,
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    }, '-=0.4');

// ========================================
// Navigation Interactions
// ========================================

const navTrigger = document.querySelector('.nav__trigger');
const nav = document.querySelector('.nav');

navTrigger.addEventListener('click', () => {
    nav.classList.toggle('is-open');
    
    const dot = nav.querySelector('.nav__indicator-dot');
    
    if (nav.classList.contains('is-open')) {
        gsap.to(dot, {
            scale: 1.5,
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
        
        gsap.from('.nav__link', {
            x: 20,
            opacity: 0,
            duration: DURATION_MICRO,
            stagger: STAGGER_DELAY,
            ease: EASE_HEAVY
        });
    } else {
        gsap.to(dot, {
            scale: 1,
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
    }
});

// Smooth scroll for nav links
document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        
        gsap.to(window, {
            duration: 2,
            scrollTo: { y: target, offsetY: 0 },
            ease: EASE_LUXURY
        });
        
        nav.classList.remove('is-open');
    });
});

// ========================================
// Scroll Animations
// ========================================

function initScrollAnimations() {
    
    // Progress indicator
    const sections = document.querySelectorAll('.section');
    const progressFill = document.querySelector('.progress__fill');
    const markers = document.querySelectorAll('.progress__marker');
    
    ScrollTrigger.create({
        trigger: '.canvas',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
            // Update progress fill
            gsap.to(progressFill, {
                height: `${self.progress * 100}%`,
                duration: 0.3,
                ease: 'power2.out'
            });
            
            // Update section markers
            const currentSection = Math.floor(self.progress * sections.length);
            markers.forEach((marker, i) => {
                marker.classList.toggle('is-active', i === currentSection);
            });
        }
    });
    
    // ========================================
    // Section I: Manifesto Animations
    // ========================================
    
    const manifestoSection = document.querySelector('.section--manifesto');
    
    // Title reveal with word animation
    gsap.from('.section--manifesto .title__line', {
        scrollTrigger: {
            trigger: manifestoSection,
            start: 'top 70%',
            end: 'top 30%',
            scrub: 1
        },
        y: 100,
        opacity: 0,
        stagger: 0.1
    });
    
    // Lead text reveal
    gsap.from('.manifesto__text', {
        scrollTrigger: {
            trigger: manifestoSection,
            start: 'top 60%',
            end: 'top 20%',
            scrub: 1.5
        },
        y: 60,
        opacity: 0
    });
    
    // Decorative line reveal
    gsap.from('.manifesto__text::before', {
        scrollTrigger: {
            trigger: manifestoSection,
            start: 'top 50%',
            scrub: 1
        },
        scaleX: 0,
        transformOrigin: 'left'
    });
    
    // Corner glyph with subtle rotation tied to scroll
    gsap.to('.section--manifesto .glyph--rotation', {
        scrollTrigger: {
            trigger: manifestoSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 2
        },
        rotation: 90,
        ease: 'none'
    });
    
    // Parallax on guilloche texture
    gsap.to('.section--manifesto .texture--guilloche', {
        scrollTrigger: {
            trigger: manifestoSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1
        },
        x: -50,
        opacity: 0.3
    });
    
    // ========================================
    // Section II: Collection Animations
    // ========================================
    
    const collectionSection = document.querySelector('.section--collection');
    
    // Title character stagger
    gsap.from('.section--collection .title__word', {
        scrollTrigger: {
            trigger: collectionSection,
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        y: 80,
        opacity: 0,
        duration: DURATION_MEDIUM,
        stagger: STAGGER_DELAY * 2,
        ease: EASE_LUXURY
    });
    
    // Showcase artifact reveal
    gsap.from('.showcase__frame', {
        scrollTrigger: {
            trigger: collectionSection,
            start: 'top 60%',
            end: 'center center',
            scrub: 1
        },
        scale: 0.8,
        opacity: 0,
        rotation: -5
    });
    
    // Artifact hover layers
    gsap.to('.showcase__artifact', {
        scrollTrigger: {
            trigger: collectionSection,
            start: 'center center',
            end: 'bottom center',
            scrub: 1
        },
        y: -30
    });
    
    // Deep texture parallax
    gsap.to('.section--collection .texture--deep', {
        scrollTrigger: {
            trigger: collectionSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1
        },
        y: -80,
        scale: 1.1
    });
    
    // ========================================
    // Section III: Craft Animations
    // ========================================
    
    const craftSection = document.querySelector('.section--craft');
    
    // Visual layers parallax depth
    gsap.to('.visual__layer--back', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1
        },
        y: -40
    });
    
    gsap.to('.visual__layer--mid', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.5
        },
        y: -80
    });
    
    gsap.to('.visual__layer--front', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 2
        },
        y: -120
    });
    
    // Title reveal
    gsap.from('.section--craft .title__line', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        y: 100,
        opacity: 0,
        duration: DURATION_MEDIUM,
        stagger: STAGGER_DELAY * 1.5,
        ease: EASE_LUXURY
    });
    
    // Body text fade
    gsap.from('.section--craft .text--body', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top 60%',
            toggleActions: 'play none none reverse'
        },
        y: 40,
        opacity: 0,
        duration: DURATION_MEDIUM,
        delay: 0.4,
        ease: EASE_HEAVY
    });
    
    // Metrics stagger
    gsap.from('.metric', {
        scrollTrigger: {
            trigger: craftSection,
            start: 'top 50%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: DURATION_MEDIUM,
        stagger: STAGGER_DELAY * 2,
        ease: EASE_LUXURY
    });
    
    // ========================================
    // Section IV: Contact Animations
    // ========================================
    
    const contactSection = document.querySelector('.section--contact');
    
    // Enclosure reveal
    gsap.from('.contact__enclosure', {
        scrollTrigger: {
            trigger: contactSection,
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        scale: 0.95,
        opacity: 0,
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    });
    
    // Title word animation
    gsap.from('.title--contact', {
        scrollTrigger: {
            trigger: contactSection,
            start: 'top 60%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    });
    
    // Body content fade up
    gsap.from('.contact__body > *', {
        scrollTrigger: {
            trigger: contactSection,
            start: 'top 50%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: DURATION_MICRO,
        stagger: STAGGER_DELAY,
        ease: EASE_HEAVY
    });
    
    // Seal rotation
    gsap.from('.seal__ring', {
        scrollTrigger: {
            trigger: contactSection,
            start: 'top 40%',
            toggleActions: 'play none none reverse'
        },
        rotation: -90,
        opacity: 0,
        duration: DURATION_MEDIUM,
        ease: EASE_LUXURY
    });
}

// ========================================
// Scroll Velocity Effects
// ========================================

let scrollVelocity = 0;
let lastScrollTop = 0;
let velocityRAF = null;

function updateScrollVelocity() {
    const currentScroll = window.pageYOffset;
    const rawVelocity = currentScroll - lastScrollTop;
    
    // Smooth velocity
    scrollVelocity += (rawVelocity - scrollVelocity) * SCROLL_SMOOTHING;
    
    // Clamp velocity impact
    const clampedVelocity = Math.max(-MAX_SCROLL_IMPACT, Math.min(MAX_SCROLL_IMPACT, scrollVelocity * 0.01));
    
    // Apply subtle effects based on velocity
    document.querySelectorAll('.section').forEach(section => {
        const rect = section.getBoundingClientRect();
        const isInView = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isInView) {
            // Subtle scale based on velocity
            gsap.to(section, {
                scale: 1 + Math.abs(clampedVelocity) * 0.02,
                duration: 0.3,
                ease: 'power2.out'
            });
        }
    });
    
    lastScrollTop = currentScroll;
    velocityRAF = requestAnimationFrame(updateScrollVelocity);
}

// Start velocity tracking after load
loadingTimeline.eventCallback('onComplete', () => {
    velocityRAF = requestAnimationFrame(updateScrollVelocity);
});

// ========================================
// Edge Typography Scroll Response
// ========================================

gsap.to('.edge-text--left .edge-text__content', {
    scrollTrigger: {
        trigger: '.canvas',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 2
    },
    x: 100
});

gsap.to('.edge-text--right .edge-text__content', {
    scrollTrigger: {
        trigger: '.canvas',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 2
    },
    x: -100
});

// ========================================
// Mouse Interaction — Subtle Parallax
// ========================================

let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;

// Only apply on non-touch devices
if (!window.matchMedia('(pointer: coarse)').matches) {
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    
    function updateMouseParallax() {
        currentX += (mouseX - currentX) * 0.05;
        currentY += (mouseY - currentY) * 0.05;
        
        // Apply to decorative elements only
        document.querySelectorAll('.showcase__artifact').forEach(el => {
            gsap.set(el, {
                x: currentX * 10,
                y: currentY * 10
            });
        });
        
        document.querySelectorAll('.glyph--rotation').forEach(el => {
            gsap.set(el, {
                x: currentX * 5,
                y: currentY * 5
            });
        });
        
        requestAnimationFrame(updateMouseParallax);
    }
    
    updateMouseParallax();
}

// ========================================
// Navigation Hover States
// ========================================

document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('mouseenter', () => {
        gsap.to(link, {
            letterSpacing: '0.08em',
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
    });
    
    link.addEventListener('mouseleave', () => {
        gsap.to(link, {
            letterSpacing: '0.05em',
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
    });
});

// ========================================
// Contact Link Hover
// ========================================

const contactLink = document.querySelector('.contact__link');
if (contactLink) {
    contactLink.addEventListener('mouseenter', () => {
        gsap.to('.link__glyph', {
            x: 8,
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
    });
    
    contactLink.addEventListener('mouseleave', () => {
        gsap.to('.link__glyph', {
            x: 0,
            duration: DURATION_MICRO,
            ease: EASE_LUXURY
        });
    });
}
