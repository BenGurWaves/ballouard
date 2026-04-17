(function() {
  'use strict';

  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  // ========== CURSOR ==========
  if (!isTouch) {
    const cursor = document.getElementById('cursor');
    const cursorDot = cursor.querySelector('.cursor-dot');
    const cursorCircle = cursor.querySelector('.cursor-circle');
    const cursorText = cursor.querySelector('.cursor-text');
    
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let dotX = 0, dotY = 0;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });
    
    function animateCursor() {
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;
      dotX += (mouseX - dotX) * 0.5;
      dotY += (mouseY - dotY) * 0.5;
      
      cursorCircle.style.left = cursorX + 'px';
      cursorCircle.style.top = cursorY + 'px';
      cursorDot.style.left = dotX + 'px';
      cursorDot.style.top = dotY + 'px';
      cursorText.style.left = cursorX + 'px';
      cursorText.style.top = cursorY + 'px';
      
      requestAnimationFrame(animateCursor);
    }
    animateCursor();
    
    document.querySelectorAll('[data-cursor]').forEach(el => {
      const type = el.dataset.cursor;
      const text = el.dataset.cursorText;
      
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('hover-' + type);
        if (text) cursorText.textContent = text;
      });
      
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hover-' + type);
        cursorText.textContent = '';
      });
    });
  } else {
    document.getElementById('cursor').style.display = 'none';
    document.body.style.cursor = 'auto';
  }

  // ========== MAGNETIC ==========
  if (!isTouch) {
    document.querySelectorAll('.magnetic').forEach(el => {
      let rafId = null;
      let currentX = 0, currentY = 0;
      let targetX = 0, targetY = 0;
      
      function update() {
        currentX += (targetX - currentX) * 0.15;
        currentY += (targetY - currentY) * 0.15;
        el.style.transform = `translate(${currentX}px, ${currentY}px)`;
        
        if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
          rafId = requestAnimationFrame(update);
        }
      }
      
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        targetX = (e.clientX - rect.left - rect.width / 2) * 0.25;
        targetY = (e.clientY - rect.top - rect.height / 2) * 0.25;
        if (!rafId) rafId = requestAnimationFrame(update);
      });
      
      el.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
        if (!rafId) rafId = requestAnimationFrame(update);
        setTimeout(() => {
          if (Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1) {
            cancelAnimationFrame(rafId);
            rafId = null;
            el.style.transform = '';
          }
        }, 300);
      });
    });
  }

  // ========== PARALLAX SCROLL ==========
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    parallaxElements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const distance = centerY - viewportCenter;
      el.style.transform = `translateY(${distance * speed}px)`;
    });
  }, { passive: true });

  // ========== LOADER ==========
  const loader = document.getElementById('loader');
  const loaderText = loader.querySelectorAll('.loader-text span');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderCanvas = document.getElementById('loader-canvas');
  
  // Loader canvas - particle network
  if (loaderCanvas) {
    const ctx = loaderCanvas.getContext('2d');
    let w, h;
    
    function resize() {
      w = loaderCanvas.width = window.innerWidth;
      h = loaderCanvas.height = window.innerHeight;
    }
    resize();
    
    const particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1
      });
    }
    
    let frame = 0;
    function animateLoader() {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
      ctx.fillRect(0, 0, w, h);
      
      // Draw connections
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.1)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        
        // Draw particle
        ctx.fillStyle = 'rgba(37, 99, 235, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Connect nearby
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      
      frame = requestAnimationFrame(animateLoader);
    }
    animateLoader();
  }
  
  // Loading sequence
  document.body.style.overflow = 'hidden';
  let progress = 0;
  
  const loadInt = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadInt);
      loaderPercent.textContent = '100%';
      
      // Reveal text
      loaderText.forEach((char, i) => {
        setTimeout(() => char.classList.add('visible'), i * 80);
      });
      
      // Hide loader
      setTimeout(() => {
        loader.classList.add('hidden');
        document.body.style.overflow = '';
        if (frame) cancelAnimationFrame(frame);
        initHero();
      }, 2000);
    } else {
      loaderPercent.textContent = Math.floor(progress) + '%';
    }
  }, 100);

  // ========== HERO CANVAS - Constellation ==========
  function initHero() {
    const heroCanvas = document.getElementById('hero-canvas');
    if (!heroCanvas) return;
    
    const ctx = heroCanvas.getContext('2d');
    let w, h;
    
    function resize() {
      w = heroCanvas.width = heroCanvas.offsetWidth;
      h = heroCanvas.height = heroCanvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    
    // Create constellation particles
    const stars = [];
    const numStars = 150;
    
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2,
        alpha: Math.random() * 0.5 + 0.2
      });
    }
    
    let mouse = { x: w / 2, y: h / 2 };
    
    heroCanvas.addEventListener('mousemove', (e) => {
      const rect = heroCanvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });
    
    function animate() {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
      ctx.fillRect(0, 0, w, h);
      
      // Update and draw stars
      stars.forEach(star => {
        star.x += star.vx;
        star.y += star.vy;
        
        // Wrap around
        if (star.x < 0) star.x = w;
        if (star.x > w) star.x = 0;
        if (star.y < 0) star.y = h;
        if (star.y > h) star.y = 0;
        
        // Mouse attraction
        const dx = mouse.x - star.x;
        const dy = mouse.y - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200) {
          star.x += dx * 0.001;
          star.y += dy * 0.001;
        }
        
        // Draw star
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw connections near mouse
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 100) {
            const mouseDist = Math.sqrt(
              Math.pow(stars[i].x - mouse.x, 2) +
              Math.pow(stars[i].y - mouse.y, 2)
            );
            
            if (mouseDist < 300) {
              ctx.beginPath();
              ctx.moveTo(stars[i].x, stars[i].y);
              ctx.lineTo(stars[j].x, stars[j].y);
              ctx.stroke();
            }
          }
        }
      }
      
      requestAnimationFrame(animate);
    }
    animate();
    
    // Hero text reveals
    const heroLines = document.querySelectorAll('.ht-line');
    const heroEyebrow = document.querySelector('.hero-eyebrow');
    const heroDesc = document.querySelector('.hero-desc');
    const heroCta = document.querySelector('.hero-cta-group');
    
    heroEyebrow.classList.add('visible');
    
    heroLines.forEach((line, i) => {
      setTimeout(() => line.classList.add('visible'), 200 + i * 200);
    });
    
    setTimeout(() => heroDesc.classList.add('visible'), 800);
    setTimeout(() => heroCta.classList.add('visible'), 1000);
  }

  // ========== NAV VISIBILITY ==========
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  
  window.addEventListener('scroll', () => {
    const heroBottom = hero.getBoundingClientRect().bottom;
    if (heroBottom < 100) {
      nav.classList.add('visible');
    } else {
      nav.classList.remove('visible');
    }
  }, { passive: true });

  // ========== MENU ==========
  const menuBtn = document.getElementById('menu-btn');
  const menuOverlay = document.getElementById('menu-overlay');
  
  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    menuOverlay.classList.toggle('active');
    document.body.style.overflow = menuOverlay.classList.contains('active') ? 'hidden' : '';
  });
  
  menuOverlay.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // ========== SCROLL REVEALS ==========
  const revealEls = document.querySelectorAll('[data-reveal]');
  
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -100px 0px' });
  
  revealEls.forEach(el => revealObs.observe(el));

  // ========== PROCESS SCROLL ANIMATION ==========
  const processCards = document.querySelectorAll('.process-card');
  
  const processObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, { threshold: 0.5, rootMargin: '-20% 0px -20% 0px' });
  
  processCards.forEach(card => processObs.observe(card));

  // ========== REVIEWS SLIDER ==========
  const reviews = document.querySelectorAll('.review');
  const dots = document.querySelectorAll('.rn-dot');
  const progressFill = document.getElementById('review-progress');
  let currentReview = 0;
  let autoReview;
  
  function resetProgress() {
    if (progressFill) {
      progressFill.classList.remove('animating');
      void progressFill.offsetWidth; // Force reflow
      progressFill.classList.add('animating');
    }
  }
  
  function showReview(i) {
    currentReview = i;
    reviews.forEach((r, idx) => r.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    resetProgress();
  }
  
  function nextReview() {
    showReview((currentReview + 1) % 3);
  }
  
  function startAuto() {
    resetProgress();
    autoReview = setInterval(nextReview, 5000);
  }
  
  function stopAuto() {
    clearInterval(autoReview);
    if (progressFill) progressFill.classList.remove('animating');
  }
  
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      stopAuto();
      showReview(parseInt(dot.dataset.i));
      startAuto();
    });
  });
  
  // Start auto-rotation
  startAuto();
  
  // Pause on hover
  document.querySelector('.reviews-section').addEventListener('mouseenter', stopAuto);
  document.querySelector('.reviews-section').addEventListener('mouseleave', startAuto);

  // ========== CTA CANVAS - Particles ==========
  const ctaCanvas = document.getElementById('cta-particles');
  if (ctaCanvas) {
    const ctx = ctaCanvas.getContext('2d');
    let w, h;
    
    function resize() {
      w = ctaCanvas.width = ctaCanvas.offsetWidth;
      h = ctaCanvas.height = ctaCanvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 3 + 1
      });
    }
    
    function animateCta() {
      ctx.fillStyle = 'rgba(250, 250, 250, 0.05)';
      ctx.fillRect(0, 0, w, h);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        
        ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      
      requestAnimationFrame(animateCta);
    }
    animateCta();
  }

  // ========== CTA REVEAL ==========
  const ctaTitle = document.querySelectorAll('.cta-title span');
  const ctaActions = document.querySelector('.cta-actions');
  
  const ctaObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        ctaTitle.forEach((span, i) => {
          setTimeout(() => span.classList.add('visible'), i * 150);
        });
        setTimeout(() => ctaActions.classList.add('visible'), 500);
        ctaObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  
  if (document.querySelector('.cta-section')) {
    ctaObs.observe(document.querySelector('.cta-section'));
  }

  // ========== BACK TO TOP ==========
  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();
