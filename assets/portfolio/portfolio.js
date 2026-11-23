(function () {
  var root = document.documentElement;

  // Show the Apple shortcut symbol on Apple platforms
  (function () {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    var hint = document.getElementById('k-hint');
    if (hint && /Mac|iPhone|iPad|iPod/i.test(plat)) hint.textContent = '\u2318 K';
  })();

  // Before/after comparers
  var calmMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-cmp]').forEach(function (cmp) {
    var ba = cmp.querySelector('.ba'), range = ba.querySelector('input'), note = cmp.querySelector('.cmp-note');
    var after = ba.querySelector('img.after'), before = ba.querySelector('img.before');
    var v1Label = ba.querySelector('.tag.l').textContent.split(' · ')[1];
    function set(v) { range.value = v; ba.style.setProperty('--pos', v + '%'); }
    var touched = false;
    range.addEventListener('input', function () { touched = true; set(range.value); });
    var tabs = cmp.querySelectorAll('[role="tab"]');
    var panel = ba;
    var preloaded = false;
    function preloadTabs() {
      if (preloaded) return; preloaded = true;
      tabs.forEach(function (t) { if (t.dataset.v1) new Image().src = t.dataset.v1; if (t.dataset.v2) new Image().src = t.dataset.v2; });
    }
    tabs.forEach(function (tab, idx) {
      tab.addEventListener('pointerenter', preloadTabs, { once: true });
      tab.addEventListener('click', function () {
        preloadTabs();
        tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === tab)); x.tabIndex = x === tab ? 0 : -1; });
        panel.setAttribute('aria-labelledby', tab.id);
        var what = tab.dataset.what;
        before.src = tab.dataset.v1; before.alt = v1Label + ' ' + what;
        after.src = tab.dataset.v2; after.alt = 'v2 ' + what;
        range.setAttribute('aria-label', 'Drag to compare the ' + v1Label + ' ' + what + ' with v2');
        note.textContent = tab.dataset.note;
        touched = true; set(50);
      });
      tab.addEventListener('keydown', function (e) {
        var to = -1, n = tabs.length;
        if (e.key === 'ArrowRight') to = (idx + 1) % n;
        else if (e.key === 'ArrowLeft') to = (idx - 1 + n) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to < 0) return;
        e.preventDefault();
        tabs[to].focus(); tabs[to].click();
      });
    });
    // One sweep when it first scrolls into view, so both versions get seen (and preload comparator tabs lazily)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        preloadTabs();
        if (calmMotion) return;
        var t0 = null, from = 50;
        function step(ts) {
          if (touched) return;
          if (t0 === null) t0 = ts;
          var k = Math.min((ts - t0) / 1800, 1);
          var v = from + Math.sin(k * Math.PI * 2) * 35 * (1 - k);
          set(Math.round(v * 10) / 10);
          if (k < 1) requestAnimationFrame(step); else set(50);
        }
        requestAnimationFrame(step);
      }, { threshold: .6 });
      io.observe(ba);
    }
  });

  // Card spotlight
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // Filters
  var cards = Array.prototype.slice.call(document.querySelectorAll('#bento .card'));
  var btns = document.querySelectorAll('.filters button');
  btns.forEach(function (b) {
    var f = b.getAttribute('data-filter');
    if (f !== 'all') {
      var n = cards.filter(function (c) { return c.getAttribute('data-tags').split(' ').indexOf(f) > -1; }).length;
      var s = document.createElement('span'); s.className = 'count'; s.textContent = n; b.appendChild(s);
    }
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var shown = 0;
      cards.forEach(function (c) {
        var on = f === 'all' || c.getAttribute('data-tags').split(' ').indexOf(f) > -1;
        c.hidden = !on; if (on) shown++;
      });
      document.getElementById('filter-empty').hidden = shown > 0;
    });
  });

  // Copy email
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var toast = document.getElementById('toast-foot');
      function done(m) { toast.textContent = m; setTimeout(function () { toast.textContent = ''; }, 2500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done('Email copied'); }, function () { done('Copy this address: ' + text); });
      } else { done('Copy this address: ' + text); }
    });
  });

  // Quick jump (Ctrl+K)
  var items = [
    ['Me', '#me', 'section'], ['At a glance', '#glance', 'section'], ['Selected work', '#work', 'section'], ['Experience and education timeline', '#journey', 'section'], ['Skills', '#toolkit', 'section'], ['Credentials and profiles', '#credentials', 'section'], ['What I studied at UTP', '#studied', 'section'], ['Status report and activity', '#pulse', 'section'], ['Why I do this', '#why', 'section'], ['Notes', '#notes', 'section'], ['Contact', '#contact', 'section'],
    ['SMK Subang data dashboard', '#p-smk', 'project'], ['TaskMatch v2', '#p-taskmatch', 'project'], ['MyLokalEvent v2', '#p-mle', 'project'], ['IT Asset Disposal (SLB)', '#p-slb', 'project'], ['KakiLima', '#p-kakilima', 'project'], ['JumaatFinder', '#p-jumaat', 'project'], ['EagleSan Sandbox (Roblox)', '#p-roblox', 'project'],
    ['Download CV (PDF)', '/assets/Muhammad-Alif-Najmi-CV.pdf?v=cv20261119a', 'cv'], ['Email Alif', 'mailto:alifnajmx@gmail.com', 'contact'], ['LinkedIn', 'https://www.linkedin.com/in/muhammad-alif-najmi-md-hisamudin', 'link'], ['GitHub', 'https://github.com/7YMERA', 'link'], ['Credly badges', 'https://www.credly.com/users/muhammad-alif-najmi-md-hisamudin', 'link'], ['AWS badges', 'https://skillsprofile.skillbuilder.aws/user/najmi/certification-badges', 'link'], ['Kracked Devs', 'https://krackeddevs.com/profile/alifnajmx', 'link'], ['Résumé (read online)', '/resume.html', 'link'],
    ['Try TaskMatch demo', 'https://taskmatch-umber.vercel.app', 'live'], ['Visit MyLokalEvent', 'https://mylokalevent.vercel.app', 'live'], ['Visit KakiLima', 'https://kakilima-iota.vercel.app', 'live'], ['Click through the IT Asset Disposal app', '/notes/slb-screens.html', 'live'],
    ['Home', '/', 'page'], ['Play (games and toys)', '/play/', 'page'], ['Lab (satellites, shaders, SQL, Score Lab)', '/lab/', 'page'], ['Fly the drone view', '/#enter', 'page'], ['All notes', '/notes/', 'note'],
    ['Note: Building this site (3D KL, zero frameworks)', '/notes/portfolio-site.html', 'note'], ['Note: Nine charts before one screen (SLB data model)', '/notes/slb-design.html', 'note'], ['Note: A dashboard 150 teachers actually open', '/notes/smk-dashboard.html', 'note'], ['Note: From coursework to something people could trust', '/notes/mylokalevent-v2.html', 'note'], ['Note: Accessible first, in four languages', '/notes/kakilima.html', 'note'], ['Note: Where can I solat Jumaat from here?', '/notes/jumaatfinder.html', 'note'], ['Note: One VPC, two departments, $56 (AWS coursework)', '/notes/aws-two-departments.html', 'note'], ['Note: A whole company in 49 tables (SQL playground)', '/notes/database.html', 'note'], ['Note: Jom Al-Quran, 56 tables (SQL playground)', '/notes/jom-al-quran.html', 'note'], ['Note: Rebuilding my FYP properly', '/notes/taskmatch-v2.html', 'note'], ['Note: From reply-all to Power Apps', '/notes/slb-power-apps.html', 'note'], ['Note: Four years, one walk across the stage', '/notes/convocation-2026.html', 'note'],
    ['Keyboard shortcuts', '#do-keys', 'action'], ['Sound on or off', '#do-sound', 'action'], ['Share this site', '#do-share', 'action']
  ];
  var qj = document.getElementById('qj'), qi = document.getElementById('qj-input'), ql = document.getElementById('qj-list'), sel = 0, last = null;
  function render() {
    var q = qi.value.toLowerCase().trim();
    var list = items.filter(function (it) { return !q || it[0].toLowerCase().indexOf(q) > -1 || it[2].indexOf(q) > -1; });
    sel = Math.min(sel, Math.max(list.length - 1, 0));
    ql.innerHTML = '';
    if (!list.length) { ql.innerHTML = '<li class="qj-empty">No matches. Try "demo" or "contact".</li>'; return; }
    list.forEach(function (it, k) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = it[1]; a.className = k === sel ? 'on' : '';
      if (it[1].indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
      if (it[2] === 'cv') a.setAttribute('download', 'Muhammad-Alif-Najmi-CV.pdf');
      a.innerHTML = '<b></b><span></span>'; a.firstChild.textContent = it[0]; a.lastChild.textContent = it[2];
      a.addEventListener('click', close);
      li.appendChild(a); ql.appendChild(li);
    });
  }
  function open() { last = document.activeElement; qj.hidden = false; qi.value = ''; sel = 0; render(); qi.focus(); }
  function close() { qj.hidden = true; if (last) last.focus(); }
  document.getElementById('qj-open').addEventListener('click', open);
  qj.addEventListener('click', function (e) { if (e.target === qj) close(); });
  qi.addEventListener('input', function () { sel = 0; render(); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); qj.hidden ? open() : close(); return; }
    if (qj.hidden) return;
    var links = ql.querySelectorAll('a');
    if (e.key === 'Tab') {
      var f = [qi].concat(Array.prototype.slice.call(links)), at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at < 0 || at === f.length - 1 ? 0 : at + 1)].focus();
    }
    else if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); sel = (sel + 1) % links.length; render(); }
    else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); sel = (sel - 1 + links.length) % links.length; render(); }
    else if (e.key === 'Enter' && links[sel]) { e.preventDefault(); links[sel].click(); }
  });

  // Interactive BA Requirement Simulator (#ba-sim)
  var SIM_DATA = {
    smk: {
      pt: 'Scattered Linktree & spreadsheets',
      pd: '~150 teachers at SMK Subang chased ministry deadlines across dead links and WhatsApp forwards with zero overdue visibility.',
      st: 'Zero-PII data model & triage spec',
      sd: 'Separated public aggregate counts from authenticated teacher names (RLS), mapped role-scoped views, and spec\'d one-tap WhatsApp reminder exports.',
      ot: 'Live daily hub (~150 teachers)',
      od: 'Shipped in Next.js, Express, Supabase & Apps Script. Adopted daily on mobile across the school.',
      href: '/notes/smk-dashboard.html', lbl: 'Read the full write-up \u2192'
    },
    slb: {
      pt: 'Reply-all emails & manual Excel logs',
      pd: 'IT asset disposals at SLB bounced across email threads with missing sign-offs, unclear custody, and slow audit prep.',
      st: '9 process charts, 3NF ERD & RBAC',
      sd: 'Mapped end-to-end BPMN flows before a single screen, normalized SharePoint lists into a clean relational model, and defined role-gated approval states.',
      ot: '26-screen Power Apps workflow',
      od: 'Built end-to-end with Power Apps & Power Automate — full audit trail and clickable 26-screen interactive walkthrough.',
      href: '/notes/slb-screens.html', lbl: 'Click through all 26 screens \u2192'
    },
    tm: {
      pt: 'Tasks assigned by gut feel',
      pd: 'Project leads overloaded senior members while junior skills went unused, with no objective view of workload or fit.',
      st: 'Weighted fit scoring & API contracts',
      sd: 'Specified a 100-point transparent fit formula (skills, proven history, capacity, track record) with self-tuning weights and role-based audit rules.',
      ot: 'Production v2 with CI & live demo',
      od: 'Rebuilt from UTP FYP into Next.js + FastAPI + Supabase with 13 releases, pytest CI, and zero-login public demo.',
      href: '/notes/taskmatch-v2.html', lbl: 'Read the TaskMatch v2 story \u2192'
    }
  };
  var simTabs = document.querySelectorAll('[data-sim]');
  if (simTabs.length) {
    var simOut = document.getElementById('ba-sim-out');
    simTabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var d = SIM_DATA[b.dataset.sim]; if (!d) return;
        simTabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        document.getElementById('sim-p-t').textContent = d.pt;
        document.getElementById('sim-p-d').textContent = d.pd;
        document.getElementById('sim-s-t').textContent = d.st;
        document.getElementById('sim-s-d').textContent = d.sd;
        document.getElementById('sim-o-t').textContent = d.ot;
        document.getElementById('sim-o-d').textContent = d.od;
        var lnk = document.getElementById('sim-link'); lnk.href = d.href; lnk.textContent = d.lbl;
        if (simOut) { simOut.classList.remove('pop'); void simOut.offsetWidth; simOut.classList.add('pop'); }
        if (window.SFX && SFX.tick) SFX.tick();
      });
    });
  }

  // Interactive Role Fit Matrix (#role-fit)
  var ROLE_FIT = {
    ba: {
      keys: ['Requirements elicitation', 'FRD / FSD', 'Process mapping', 'Gap & issue tracking', 'AI use-case discovery', 'SQL', 'Data modelling (3NF)', 'Power BI', 'UAT planning', 'End-to-end test cases', 'Postman API testing', 'Claude', 'ChatGPT', 'Gemini', 'Statistics'],
      msg: '<strong>Business Analyst fit:</strong> Daily BA in a Solution Architect team across 6 sectors — requirements, BPMN, 3NF ERDs, UAT packs, and live prototypes.',
      links: [['SLB 9 Charts & ERD', '/notes/slb-design.html'], ['SMK Subang Spec', '/notes/smk-dashboard.html'], ['Download CV', '/assets/Muhammad-Alif-Najmi-CV.pdf?v=cv20261119a']]
    },
    se: {
      keys: ['AI use-case discovery', 'Requirements elicitation', 'Process mapping', 'SQL', 'PostgreSQL', 'Row-level security', 'Data modelling (3NF)', 'Python', 'FastAPI', 'Power Apps', 'Power Automate', 'SharePoint', 'Supabase', 'AWS (VPC, IAM)', 'Amazon Bedrock', 'Postman API testing', 'Networking', 'Security & encryption'],
      msg: '<strong>Solutions Engineer fit:</strong> Translates client workflows into working AWS / Power Platform / AI PoCs with clean security, VPC isolation, and API specs.',
      links: [['AWS Multi-Dept VPC', '/notes/aws-two-departments.html'], ['SLB 26 Screens', '/notes/slb-screens.html'], ['Jom Al-Quran SQL', '/notes/jom-al-quran.html']]
    },
    pb: {
      keys: ['TypeScript', 'Next.js', 'React', 'Tailwind', 'Python', 'FastAPI', 'Express', 'Git & GitHub Actions', 'PostgreSQL', 'Row-level security', 'Supabase', 'Vercel', 'Google Apps Script', 'Claude Code & Kiro', 'End-to-end test cases'],
      msg: '<strong>Product Builder fit:</strong> Ships end-to-end production apps solo — WCAG-audited UI, RLS databases, CI test suites, and zero-framework WebGL.',
      links: [['TaskMatch v2', '/notes/taskmatch-v2.html'], ['MyLokalEvent v2', '/notes/mylokalevent-v2.html'], ['Building This Site', '/notes/portfolio-site.html']]
    }
  };
  var fitBtns = document.querySelectorAll('[data-role]'), fitNote = document.getElementById('role-fit-note');
  if (fitBtns.length) {
    var leaves = [].slice.call(document.querySelectorAll('#toolkit .st-leaves li'));
    var branches = [].slice.call(document.querySelectorAll('#toolkit .st-branch'));
    fitBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var r = b.dataset.role, cfg = ROLE_FIT[r];
        fitBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (!cfg) {
          leaves.forEach(function (li) { li.classList.remove('fit-on', 'fit-dim'); });
          if (fitNote) { fitNote.hidden = true; fitNote.innerHTML = ''; }
          return;
        }
        branches.forEach(function (d) { d.open = true; });
        var matched = 0;
        leaves.forEach(function (li) {
          var txt = (li.firstChild && li.firstChild.textContent ? li.firstChild.textContent : li.textContent).trim();
          var hit = cfg.keys.indexOf(txt) >= 0;
          li.classList.toggle('fit-on', hit);
          li.classList.toggle('fit-dim', !hit);
          if (hit) matched++;
        });
        if (fitNote) {
          fitNote.innerHTML = '<p>' + cfg.msg + ' <span class="pf-fit-cnt">' + matched + ' matching skills highlighted</span></p><div class="pf-fit-links">' +
            cfg.links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + ' \u2192</a>'; }).join('') + '</div>';
          fitNote.hidden = false;
        }
        if (window.SFX && SFX.tick) SFX.tick();
      });
    });
  }
})();
/* Portfolio page: header height, the on-page nav, Highlights / Full story, and quiet reveals.
   Everything here is enhancement: without it the page is one long, fully readable column. */
(function () {
  var d = document, root = d.documentElement;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'pfView';

  // The header (bar + on-page nav) is sticky; anchors and the scroll spy need to know how tall it is.
  var head = d.querySelector('header.top');
  function measure() { if (head) root.style.setProperty('--pf-head', Math.round(head.getBoundingClientRect().height) + 'px'); }
  measure();
  if (head && 'ResizeObserver' in window) new ResizeObserver(measure).observe(head); else addEventListener('resize', measure);

  // Highlights = what a hiring decision needs; Full story = everything.
  var viewBtns = d.querySelectorAll('.pf-view button');
  function relayout() { dispatchEvent(new Event('resize')); }  // scene.js re-reads where each section is
  function setView(v, persist) {
    var brief = v === 'brief';
    root.classList.toggle('pf-brief', brief);
    viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
    if (persist) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    relayout(); requestAnimationFrame(relayout);
  }
  viewBtns.forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view, true); }); });
  var start = 'full';
  try { if (/[?&]view=brief/.test(location.search)) start = 'brief'; else if (localStorage.getItem(KEY) === 'brief') start = 'brief'; } catch (e) {}
  if (start === 'brief') setView('brief', false);

  function goTo(el, smooth) {
    if (!el) return;
    var h = parseFloat(getComputedStyle(root).getPropertyValue('--pf-head')) || 110;
    scrollTo({ top: el.getBoundingClientRect().top + scrollY - h - 12, behavior: smooth && !calm ? 'smooth' : 'auto' });
  }
  var briefGo = d.getElementById('pf-brief-go');
  if (briefGo) briefGo.addEventListener('click', function () { setView('brief', true); requestAnimationFrame(function () { goTo(d.getElementById('glance'), true); }); });

  // A link to a section that Highlights hides brings the full story back first.
  d.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]'); if (!a || !root.classList.contains('pf-brief')) return;
    var id = a.getAttribute('href').slice(1), el = id && d.getElementById(id);
    if (!el || el.offsetHeight > 0) return;
    ev.preventDefault(); setView('full', true);
    requestAnimationFrame(function () { goTo(d.getElementById(id), false); try { history.replaceState(null, '', '#' + id); } catch (e) {} });
  }, true);

  // On-page nav: mark the section you are in, and keep that link in view on a phone.
  var links = Array.prototype.slice.call(d.querySelectorAll('.pf-sub-links a'));
  var map = {}, secs = [];
  links.forEach(function (a) { var el = d.getElementById(a.getAttribute('href').slice(1)); if (el) { map[el.id] = a; secs.push(el); } });
  var why = d.getElementById('why'); if (why && map.notes) { map.why = map.notes; secs.splice(secs.indexOf(d.getElementById('notes')), 0, why); }
  var rail = d.querySelector('.pf-sub-links');
  function mark(id) {
    links.forEach(function (a) { var on = map[id] === a; if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    var a = map[id];
    if (a && rail && rail.scrollWidth > rail.clientWidth) {
      var want = a.offsetLeft - (rail.clientWidth - a.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, want), behavior: calm ? 'auto' : 'smooth' });
    }
  }
  var tickSpy = 0;
  function spy() {
    tickSpy = 0;
    var h = parseFloat(getComputedStyle(root).getPropertyValue('--pf-head')) || 110, line = h + innerHeight * .28, cur = null;
    secs.forEach(function (el) { if (el.offsetHeight > 0 && el.getBoundingClientRect().top <= line) cur = el; });
    if (innerHeight + scrollY >= d.documentElement.scrollHeight - 4) cur = d.getElementById('contact') || cur;
    mark(cur ? cur.id : 'me');
  }
  addEventListener('scroll', function () { if (!tickSpy) tickSpy = requestAnimationFrame(spy); }, { passive: true });
  addEventListener('resize', spy); spy();

  // Quiet reveals: opacity and transform only, once.
  if (!calm && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .04 });
    d.querySelectorAll('.pf-s .sec-head, .nb-head, .pf-glance, .pf-bring, .pf-cred li, .pf-fly-card, .pl-stats, .contact .wrap > *').forEach(function (el, i) {
      el.classList.add('pf-rv'); io.observe(el);
    });
  }
})();
