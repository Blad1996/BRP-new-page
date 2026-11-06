// Biz Rescue Pro - shared site behaviour. Each init is a no-op if its markup isn't on the page.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('overflow-hidden', open);
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initReveal() {
  document.querySelectorAll('[data-stagger], [data-slide]').forEach((parent) => {
    [...parent.children].forEach((child, i) => child.style.setProperty('--i', i));
  });
  const items = document.querySelectorAll('[data-reveal], [data-stagger], [data-slide]');
  if (!items.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  items.forEach((el) => io.observe(el));
}

// Accessible tabs (arrow keys, Home/End). Used by the problem selector.
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const cta = document.querySelector('[data-problem-cta]');

    const select = (tab, focus = true) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (cta) {
        cta.dataset.topic = tab.dataset.topic || '';
        if (!cta.getAttribute('href').startsWith('#')) cta.href = `contact.html?topic=${encodeURIComponent(cta.dataset.topic)}`;
      }
      if (focus) tab.focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select(tabs[(keys[e.key] + tabs.length) % tabs.length]);
      });
    });

    const current = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    if (current) select(current, false);
  });
}

// Links with data-plan / data-topic preselect the form topic.
function initTopicLinks() {
  const select = document.getElementById('f-topic');
  if (!select) return;
  const fromUrl = new URLSearchParams(location.search).get('topic');
  if (fromUrl && [...select.options].some((o) => o.value === fromUrl)) select.value = fromUrl;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-plan], [data-problem-cta]');
    if (!link) return;
    const value = link.dataset.plan || link.dataset.topic;
    if (value && [...select.options].some((o) => o.value === value)) select.value = value;
  });
}

function initForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = form.querySelector('[data-form-status]');

  const messages = {
    name: 'Enter your name.',
    email: 'Enter an email address like name@yourfarm.ca.',
    business: 'Enter your business or farm name.',
    setup: 'Add a few lines about your setup.',
  };

  const check = (field) => {
    const valid = field.checkValidity() && field.value.trim() !== '';
    const err = document.getElementById(`${field.id}-err`);
    field.setAttribute('aria-invalid', String(!valid));
    if (err) err.textContent = valid ? '' : messages[field.name];
    return valid;
  };

  const fields = [...form.querySelectorAll('[required]')];
  fields.forEach((f) => f.addEventListener('blur', () => { if (f.value) check(f); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = fields.filter((f) => !check(f));
    if (invalid.length) { invalid[0].focus(); status.textContent = ''; return; }

    // Set data-endpoint on the form (e.g. Formspree, Netlify, your API) to deliver requests.
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      status.textContent = 'This form is not connected yet. Add a form endpoint to start receiving requests.';
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = "Request sent. We'll reply by email to set up a first conversation.";
    } catch {
      status.textContent = 'Your request did not send. Check your connection and try again.';
    } finally {
      button.disabled = false;
    }
  });
}

// Notes for the team ([data-internal]) only show in local preview, never on the live site.
function initInternalNotes() {
  const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!local) document.querySelectorAll('[data-internal]').forEach((el) => el.remove());
}

// Services: three optional questions point to the closest plan.
function initPlanFinder() {
  const finder = document.querySelector('[data-plan-finder]');
  if (!finder) return;
  const cards = [...document.querySelectorAll('[data-plan-card]')];
  const result = finder.querySelector('[data-finder-result]');
  const names = ['Essential IT', 'Business Care', 'Managed IT & Security'];

  finder.addEventListener('change', () => {
    const answers = [...finder.querySelectorAll('input:checked')].map((i) => Number(i.value));
    if (!answers.length) return;
    const level = Math.max(...answers);
    cards.forEach((card, i) => card.classList.toggle('is-match', i === level));
    result.textContent = `Closest fit: ${names[level]}. We confirm it after a first look at your setup.`;
  });
}

// Opened from disk (file:), folder links like "slug/" show a directory listing, so point them at index.html.
const fromDisk = location.protocol === 'file:';
const dirHref = (href) => (fromDisk && href.endsWith('/') && !/^[a-z]+:/i.test(href) ? `${href}index.html` : href);
function fixDiskLinks(scope = document) {
  if (!fromDisk) return;
  scope.querySelectorAll('a[href$="/"]').forEach((a) => { a.setAttribute('href', dirHref(a.getAttribute('href'))); });
}

// Blog: posts come from data/posts.js (window.BRP_POSTS); filters by category, type and text, 20 rows at a time.
function initBlogFilter() {
  const list = document.querySelector('[data-posts]');
  const posts = window.BRP_POSTS;
  if (!list || !Array.isArray(posts)) return;

  const PAGE = 20;
  const CATS = { security: 'Cybersecurity', backup: 'Backup &amp; Continuity', email: 'Email &amp; Accounts', everyday: 'Everyday IT', managed: 'Managed IT' };
  const TYPES = { news: 'News', tips: 'Tip', guides: 'Guide' };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' });
  const search = document.querySelector('[data-post-search]');
  const count = document.querySelector('[data-post-count]');
  const empty = document.querySelector('[data-post-empty]');
  const more = document.querySelector('[data-post-more]');
  const catButtons = [...document.querySelectorAll('[data-filter-cat]')];
  const typeButtons = [...document.querySelectorAll('[data-filter-type]')];
  const fromUrl = new URLSearchParams(location.search).get('cat');
  const state = { cat: fromUrl in CATS ? fromUrl : 'all', type: 'all', q: '', limit: PAGE };
  posts.forEach((p) => { p.text = `${p.t} ${p.e}`.toLowerCase(); });

  const base = window.BRP_POST_BASE || '';
  const row = (p) => `<li><a href="${dirHref(`${base}${p.s}/`)}" class="post-row">
    <p class="label md:col-span-3"><time datetime="${p.d}">${fmt.format(new Date(`${p.d}T12:00`))}</time><span class="block text-forest">${CATS[p.c]} &nbsp;/&nbsp; ${TYPES[p.y]}</span></p>
    <div class="md:col-span-8"><h3>${esc(p.t)}</h3><p class="mt-2 max-w-2xl text-sm leading-relaxed text-sage">${esc(p.e)}</p></div>
    <span class="arrow hidden text-right md:col-span-1 md:block" aria-hidden="true">&rarr;</span></a></li>`;

  const apply = () => {
    const inCat = posts.filter((p) => (state.cat === 'all' || p.c === state.cat) && (!state.q || p.text.includes(state.q)));
    typeButtons.forEach((b) => {
      const n = b.dataset.value === 'all' ? inCat.length : inCat.filter((p) => p.y === b.dataset.value).length;
      b.textContent = `${b.dataset.label} (${n})`;
      b.disabled = n === 0 && b.dataset.value !== 'all';
    });
    const shown = inCat.filter((p) => state.type === 'all' || p.y === state.type);
    list.innerHTML = shown.slice(0, state.limit).map(row).join('');
    count.textContent = `${shown.length} ${shown.length === 1 ? 'article' : 'articles'}`;
    empty.hidden = shown.length > 0;
    more.hidden = shown.length <= state.limit;
  };

  const bindGroup = (buttons, key) => {
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      state[key] = btn.dataset.value;
      state.limit = PAGE;
      apply();
    }));
  };
  catButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === state.cat)));
  bindGroup(catButtons, 'cat');
  bindGroup(typeButtons, 'type');
  search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); state.limit = PAGE; apply(); });
  more.addEventListener('click', () => {
    const first = state.limit;
    state.limit += PAGE;
    apply();
    list.children[first]?.querySelector('a').focus();
  });
  apply();
}

// Home hero slideshow: crossfades every 6s, pauses on hover/focus, never auto-rotates with reduced motion.
function initCarousel() {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const slides = [...root.querySelectorAll('.slide')];
  const controls = document.querySelector('[data-carousel-controls]');
  if (slides.length < 2 || !controls) return;
  const dotsBox = controls.querySelector('[data-carousel-dots]');
  const toggle = controls.querySelector('[data-carousel-toggle]');
  const DELAY = 6000;
  let current = 0, timer = null, paused = reduceMotion, hovering = false;

  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carousel-dot';
    b.setAttribute('aria-label', `Show photo ${i + 1} of ${slides.length}`);
    b.addEventListener('click', () => { show(i); restart(); });
    dotsBox.append(b);
    return b;
  });

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      s.classList.toggle('is-active', n === current);
      s.setAttribute('aria-hidden', String(n !== current));
    });
    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === current)));
  }
  function restart() {
    clearInterval(timer);
    if (!paused && !hovering && !document.hidden) timer = setInterval(() => show(current + 1), DELAY);
  }
  function setPaused(p) {
    paused = p;
    toggle.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow');
    toggle.querySelector('[data-icon-pause]').toggleAttribute('hidden', p);
    toggle.querySelector('[data-icon-play]').toggleAttribute('hidden', !p);
    restart();
  }

  const figure = root.parentElement;
  figure.addEventListener('mouseenter', () => { hovering = true; restart(); });
  figure.addEventListener('mouseleave', () => { hovering = false; restart(); });
  figure.addEventListener('focusin', () => { hovering = true; restart(); });
  figure.addEventListener('focusout', () => { hovering = false; restart(); });
  document.addEventListener('visibilitychange', restart);
  toggle.addEventListener('click', () => setPaused(!paused));

  controls.hidden = false;
  show(0);
  setPaused(paused);
}

// Article: reading progress bar and current section in the table of contents.
function initArticle() {
  const bar = document.querySelector('[data-progress]');
  const article = document.querySelector('article');
  if (bar && article) {
    const update = () => {
      const r = article.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      const p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
      bar.style.setProperty('--p', p);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  const links = [...document.querySelectorAll('[data-toc] a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${entry.target.id}`)));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  links.forEach((a) => { const h = document.querySelector(a.hash); if (h) io.observe(h); });
}

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

initInternalNotes();
fixDiskLinks();
initNav();
initPlanFinder();
initBlogFilter();
initHeader();
initCarousel();
initArticle();
initReveal();
initTabs();
initTopicLinks();
initForm();
