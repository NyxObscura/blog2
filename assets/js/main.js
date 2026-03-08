/* Obscuraworks Engineering Blog — main.js */
(function () {
  'use strict';

  /* ---- Theme Toggle --------------------------------------- */
  const THEME_KEY = 'ow-theme';
  const html = document.documentElement;

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // Apply immediately to prevent flash
  setTheme(getTheme());

  document.addEventListener('DOMContentLoaded', function () {

    /* ---- Theme button ------------------------------------ */
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    }

    /* ---- Mobile nav -------------------------------------- */
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', function () {
        const open = navLinks.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', open);
      });
    }

    /* ---- Active nav link --------------------------------- */
    const path = window.location.pathname;
    document.querySelectorAll('.nav-links a').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href && href !== '/' && path.startsWith(href)) {
        link.classList.add('active');
      } else if (href === '/' && path === '/') {
        link.classList.add('active');
      }
    });

    /* ---- Copy code buttons ------------------------------- */
    document.querySelectorAll('.highlight').forEach(function (block) {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');

      btn.addEventListener('click', function () {
        const code = block.querySelector('code');
        if (!code) return;
        const text = code.innerText;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.textContent = 'copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 2000);
        });
      });

      block.appendChild(btn);

      // Add data-lang attribute from class
      const pre = block.querySelector('pre');
      if (pre) {
        const cls = pre.className || '';
        const match = cls.match(/language-(\w+)/);
        if (match) block.setAttribute('data-lang', match[1]);
      }
    });

    /* ---- Table of Contents: active tracking -------------- */
    const tocLinks = document.querySelectorAll('.toc-card nav a');
    if (tocLinks.length > 0) {
      const headings = document.querySelectorAll('.article-body h2, .article-body h3, .article-body h4');
      const navHeight = 80;

      function updateToc() {
        let current = '';
        headings.forEach(function (h) {
          if (h.getBoundingClientRect().top <= navHeight + 16) {
            current = '#' + h.id;
          }
        });
        tocLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === current);
        });
      }

      window.addEventListener('scroll', updateToc, { passive: true });
      updateToc();
    }

    /* ---- Smooth anchor scroll ---------------------------- */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          const navH = document.querySelector('.site-nav');
          const offset = navH ? navH.offsetHeight + 16 : 80;
          window.scrollTo({
            top: target.getBoundingClientRect().top + window.pageYOffset - offset,
            behavior: 'smooth'
          });
        }
      });
    });

    /* ---- Reading progress bar ----------------------------- */
    const article = document.querySelector('.article-body');
    if (article) {
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:var(--accent);z-index:9999;transition:width 0.1s linear;width:0%;pointer-events:none;';
      document.body.appendChild(bar);

      window.addEventListener('scroll', function () {
        const rect = article.getBoundingClientRect();
        const total = article.offsetHeight;
        const scrolled = -rect.top;
        const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
        bar.style.width = pct + '%';
      }, { passive: true });
    }
  });

})();
