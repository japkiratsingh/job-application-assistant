/**
 * Wellfound Auto-Apply — personal data loaded from .env
 * =====================================
 * HOW TO USE:
 * 1. Log in to wellfound.com, open https://wellfound.com/jobs
 *    and set your search filters (role, location, remote, etc.).
 * 2. Open DevTools console (F12 → Console), paste this whole file, press Enter.
 * 3. It runs in DRY_RUN mode first: it fills everything but does NOT press Send.
 *    Watch one or two applications, then re-run with DRY_RUN = false to actually apply.
 *
 * NOTES:
 * - Wellfound changes its HTML often; button/field lookup is text-based to survive
 *   that, but if it stops finding things, update the SELECTORS section.
 * - Optional: put a Google Gemini API key in CONFIG.geminiKey and any question the
 *   built-in answer bank can't match gets answered by Gemini using your CV.
 * - Auto-applying may violate Wellfound's ToS and can get an account rate-limited
 *   or banned — the delays below are deliberately human-ish. Use at your own risk.
 */
(async function wellfoundAutoApply() {
  'use strict';

  // Personal data is injected by the runner from .env (window.__APPLY_CONFIG); nothing PII is hard-coded here.
  const __CFG = (typeof window !== 'undefined' && window.__APPLY_CONFIG) || {};

  // ======================= CONFIG =======================
  const CONFIG = {
    DRY_RUN: true,             // true = fill forms but never click Send. Flip to false when ready.
    MAX_APPLICATIONS: 50,      // stop after this many applications this run (runner overrides with 50/day cap minus today's count)
    // 8-20s tripped Wellfound's DataDome bot-check on Jul 31 — human pace or bust.
    // 50 apps × ~1.5-3 min ≈ 1.5-2.5h, well inside the runner's 100-min window per batch.
    MIN_DELAY_MS: 40000,       // wait between applications (randomized between min/max)
    MAX_DELAY_MS: 100000,
    geminiKey: __CFG.geminiKey || '',   // optional: Gemini API key for unmatched questions

    // Job titles to apply to (case-insensitive substring match on the job title)
    TITLE_KEYWORDS: [
      'full stack', 'fullstack', 'full-stack', 'mern', 'backend', 'back end',
      'frontend', 'front end', 'software engineer', 'software developer',
      'software development engineer', 'application developer',
      'web developer', 'ai engineer', 'ai developer', 'ml engineer',
      'react', 'node', 'javascript', 'typescript', 'python', 'mobile',
      'react native', 'sde', 'sde 1', 'sde 2', 'sde-1', 'sde-2',
      'sde i', 'sde ii', 'member of technical staff', 'mts',
      'platform engineer', 'product engineer', 'systems engineer',
      'cloud engineer', 'infrastructure engineer', 'growth engineer',
      'devops', 'sre', 'site reliability',
      'java developer', 'python developer', 'golang', 'go developer', 'go engineer',
      'next.js', 'nextjs', 'programmer'
    ],
    // Skip jobs whose title contains any of these
    TITLE_BLOCKLIST: [
      'senior', 'principal', 'director', 'manager', 'lead',
      'data engineer', 'qa', 'test', 'intern', 'designer', 'sales', 'marketing',
      'teacher', 'trainer', 'tutor', 'instructor', 'coach', 'ios', 'android native', 'flutter', 'content','account executive', 'account'
    ],
  };

  // ======================= CV DATA (from .env via the runner) =======================
  const CV = __CFG.CV || {
    name: '', email: '', phone: '', location: '', currentRole: '', company: '', education: '',
    yearsOfExperience: '', skills: '', highlights: ['', '', '', '', ''], noticePeriod: '',
    currentCTC: '', expectedCTC: '', currentSalary: '', expectedSalary: '', dob: '', gender: '',
    workAuth: '', github: '', linkedin: '', portfolio: '', links: '', remoteOk: '', relocate: '', startDate: '',
  };

  // ============== PITCH (shared by the cover letter and the "why this company?" answer) ==============
  // Edit this block to change what every application says about you.
  const PITCH = `What interests me most is the opportunity to work on large-scale, high-impact engineering problems in an environment that values technical ownership, strong engineering standards, reliability, and continuous learning. In my current role at ${CV.company || 'CommerceIQ'}, I work on large-scale data pipelines, event-driven backend systems, and LLM agents — including a product scoring pipeline that processes 7-10M products daily on GCP Pub/Sub and Cloud Run, and an LLM anomaly-detection agent built with LangChain and LangGraph that cut weekly tickets by 82%.

My technical experience spans TypeScript, JavaScript, Python, Java, C++, SQL, Node.js, NestJS, React, PostgreSQL, MongoDB, Redis, Neo4j, Kafka, GCP (Cloud Run, Pub/Sub, Cloud Tasks, Vertex AI), Docker, CI/CD, LangChain, LangGraph, and Gemini. I particularly enjoy taking end-to-end ownership — understanding a problem, designing the solution, developing and testing it, troubleshooting production issues, and improving its scalability, reliability, and operational stability.

Before this, at Solidity Technologies, I architected an e-commerce platform from scratch for 10,000+ active users, delivered four microservices with real-time WebSocket bidding, and cut API latency by 80% (4000ms to 800ms) through query optimization, indexing, and caching.

I'm now looking for an opportunity where I can bring this combination of backend engineering, distributed systems, cloud, and applied AI to new technical challenges, while continuing to learn from strong engineering teams and contribute to products that operate at meaningful scale.`;

  // ============== QUESTION → ANSWER BANK ==============
  // First pattern that matches the question text wins. Answers come from the CV above.
  const QA_BANK = [
    [/company name|current (company|employer)|organi[sz]ation/i, CV.company], // before /name/ so "company name" isn't caught as a person's name
    [/years? of (work |professional )?experience|how (long|many years)/i,
      `I have ${CV.yearsOfExperience}. Hands-on with ${CV.skills.split(',').slice(0, 8).join(',')} and more.`],
    [/notice period|when can you (start|join)|start date|joining/i,
      `${CV.startDate}`],
    [/current .{0,15}(ctc|salary|compensation)/i, CV.currentSalary],
    [/(expected|desired) .{0,15}(ctc|salary|compensation|pay)|salary expectation/i, CV.expectedSalary],
    [/remote|work from home|wfh/i, CV.remoteOk],
    [/reloc|move to|shift to|based out of|work from (our )?office|on-?site/i, CV.relocate],
    [/visa|sponsorship|work authorization|legally authorized|right to work|citizen/i, CV.workAuth],
    [/where are you (based|located)|current location|city/i, CV.location],
    [/linkedin|github|portfolio|website|link/i, CV.links],
    // "What interests you about working for this company?" / "Why this company?" / "Why this role?" — canned polished answer.
    [/what (interests?|excites?|attracts?|draws) you|why (do you want|are you interested|this (role|company|position)|(to )?work( here)?|(to )?join)/i,
      PITCH],
    [/tell (us|me) about yourself|introduce yourself|about you/i,
      `I'm ${CV.name}, ${CV.currentRole}. ${CV.highlights[0] || ''}. Previously: ${CV.highlights[2] || ''}. ${CV.highlights[3] || ''}.`],
    [/(biggest|proudest|favorite) (project|achievement|accomplishment)|worked on/i,
      `${CV.highlights[0] || ''}. I owned it end to end, from architecture through deployment and CI/CD.`],
    [/react|frontend|front-end/i,
      `Frontend experience with React and TypeScript on the web, plus React Native for cross-platform mobile apps.`],
    [/node|backend|back-end|api/i,
      `I build production backends daily: Node.js/NestJS in TypeScript and Python, REST APIs and WebSockets, PostgreSQL/MongoDB/Redis, Kafka and GCP Pub/Sub, deployed on GCP Cloud Run with Docker and CI/CD.`],
    [/\b(ai|llm|ml|machine learning|genai|langchain)\b/i,
      `AI is a core focus: production LLM agents with LangChain and LangGraph tool-calling, Gemini on Vertex AI, prompt orchestration and evaluation loops.`],
    [/education|degree|university|college/i, CV.education],
    [/phone|contact number|mobile/i, CV.phone],
    [/e-?mail/i, CV.email],
    [/your name|full name|\bname\b/i, CV.name],
  ];

  const GENERIC_ANSWER =
    `I'm ${CV.name}, ${CV.currentRole}. Happy to elaborate in an interview — key highlights: ` +
    CV.highlights.slice(0, 2).join('; ') + '.';

  // ============== COVER LETTER (per-job: company + title filled in) ==============
  function coverLetter(company, title) {
    // Contact-footer line: skip any empty URL so we don't render " ·  · "
    const links = [CV.linkedin, CV.github, CV.portfolio].filter((u) => u && u.trim()).join(' · ');
    return `Dear Hiring Team,

I am writing to apply for the ${title || 'Software Engineer'} position at ${company || 'your company'}.

I'm ${CV.name}, currently a ${CV.currentRole || 'Software Development Engineer at CommerceIQ'}, based in ${CV.location || 'India'}, with experience building and operating large-scale production systems.

${PITCH}

Thank you for your time.

Sincerely,
${CV.name}
${CV.phone} · ${CV.email}
${links}`;
  }

  // ======================= HELPERS =======================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const humanDelay = () => sleep(CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS));
  const log = (...a) => console.log('%c[auto-apply]', 'color:#0a84ff;font-weight:bold', ...a);

  // React-controlled inputs ignore plain .value writes — use the native setter + input event.
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
                : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function labelTextOf(el) {
    return (
      el.closest('label')?.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) ||
      el.closest('div')?.previousElementSibling?.textContent ||
      el.parentElement?.textContent || ''
    ).trim();
  }

  function visible(el) {
    // getClientRects, not offsetParent — offsetParent is null for position:fixed
    // elements (modal footers), which made real Send buttons look invisible
    return el && el.getClientRects().length > 0 && !el.disabled;
  }

  // Job cards concatenate title + location + salary + "Posted 3 weeks ago" etc.
  // into one string — keep only the actual title part.
  function cleanTitle(raw) {
    return (raw || '')
      .replace(/\s+/g, ' ')
      .split(/in\s+office|remote only|on-?site|hybrid|₹|\$\d|€|posted \d|recruiter|•|\d+\s?(?:weeks?|days?|months?|hours?)\s?ago/i)[0]
      .replace(/\(?\s*remote\s*\)?$/i, '')
      .replace(/[\s\-–—|(,/]+$/g, '')
      .trim();
  }

  // Company name from the opened job pane. Falls back to '' (letter then says
  // "Hi there team" / "your team") rather than a wrong heading like "About the job".
  function getCompany() {
    // 2026 UI: the apply panel header reads "Apply to <Company>"
    const panelHeader = [...document.querySelectorAll('h1, h2, h3, div')]
      .map((e) => (e.children.length === 0 ? e.textContent.trim() : ''))
      .find((t) => /^apply to .{2,60}$/i.test(t));
    if (panelHeader) return panelHeader.replace(/^apply to /i, '').trim();
    const el =
      document.querySelector('a[href^="/company/"] h2') ||
      document.querySelector('[data-test="StartupHeader"] h1') ||
      document.querySelector('a[href^="/company/"]');
    let name = (el?.textContent || '').split('\n')[0].replace(/\s+/g, ' ').trim();
    // Reject obvious non-names (section headings, buttons, follower counts)
    if (/about the job|about us|apply|jobs|follow|save|^$/i.test(name) || name.split(' ').length > 6) name = '';
    return name;
  }

  function findButtonByText(root, regex) {
    return [...root.querySelectorAll('button, a[role="button"], [type="submit"]')]
      .find((b) => visible(b) && regex.test(b.textContent.trim()));
  }

  async function waitFor(fn, timeoutMs = 8000, pollMs = 300) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const res = fn();
      if (res) return res;
      await sleep(pollMs);
    }
    return null;
  }

  async function answerQuestion(questionText) {
    for (const [pattern, answer] of QA_BANK) {
      if (pattern.test(questionText)) return answer;
    }
    if (CONFIG.geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text:
                `You are answering a job application question on my behalf. Answer in first person, 2-4 sentences, professional, no markdown.\n\nMy CV:\n${JSON.stringify(CV)}\n\nQuestion: ${questionText}` }] }],
            }),
          }
        );
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (e) {
        log('Gemini call failed, using generic answer:', e.message);
      }
    }
    return GENERIC_ANSWER;
  }

  // ======================= SELECTORS (edit here if Wellfound changes) =======================
  const SELECTORS = {
    // job cards in the search results list — Wellfound uses div[data-test] attrs on job listings
    jobCards: '[data-test="StartupResult"] a[href*="/jobs/"], a[href^="/jobs/"][class]',
    modal: '[role="dialog"], [class*="modal" i]',
    applyButtonText: /^apply$|apply now/i,
    // The REAL submit button in Wellfound's center apply modal (2026 UI) is
    // labelled "Send application". A plain "Apply" button in the sidebar just
    // OPENS this modal — it does NOT submit. Match Send strictly.
    sendButtonText: /^send application$|^submit application$|^send$|^apply$/i,
    // Stage-1 opener button in the job-details sidebar (opens the real modal)
    openerButtonText: /^apply$/i,
    alreadyApplied: /applied/i,
  };

  // A dialog is the REAL apply modal iff it contains a "Send application" button
  // that is RENDERED (has client rects). We do NOT require it to be enabled —
  // location-mismatch jobs render Send disabled until we fill the location
  // fields, so requiring !disabled would make us abandon those modals entirely.
  function isRealApplyModal(el) {
    const hasApplicationFields = !!el.querySelector('textarea');
    return hasApplicationFields && [...el.querySelectorAll('button, [type="submit"], a[role="button"]')]
      .some((b) => b.getClientRects().length > 0 && SELECTORS.sendButtonText.test(b.textContent.trim()));
  }

  // Trusted click via the Playwright bridge; falls back to synthetic events for
  // the DevTools-console use-case (where the bridge isn't installed).
  // `force: true` bypasses Playwright's actionability checks — necessary for
  // radios/checkboxes whose native <input> is hidden behind a styled label.
  async function trustedClick(btn, { force = false } = {}) {
    btn.scrollIntoView({ block: 'center' });
    await sleep(300);
    if (typeof window.__aaClickSelector === 'function') {
      btn.setAttribute('data-aa-click', '1');
      const result = await window.__aaClickSelector('[data-aa-click="1"]', { force });
      btn.removeAttribute('data-aa-click');
      if (!result?.ok) log('  ⚠ locator.click failed:', result?.error || 'unknown');
      return result?.ok === true;
    }
    const rect = btn.getBoundingClientRect();
    const evtInit = { bubbles: true, cancelable: true, view: window, button: 0,
                      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    btn.dispatchEvent(new MouseEvent('mousedown', evtInit));
    btn.dispatchEvent(new MouseEvent('mouseup', evtInit));
    btn.dispatchEvent(new MouseEvent('click', evtInit));
    btn.click();
    return true;
  }

  async function trustedPointClick(el) {
    el.scrollIntoView({ block: 'center' });
    await sleep(150);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && typeof window.__aaClickAt === 'function') {
      return window.__aaClickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    return trustedClick(el, { force: true });
  }

  // ======================= APPLY TO ONE JOB (inside opened modal/pane) =======================
  async function fillAndSubmit(company, title) {
    // Wellfound has a TWO-STAGE apply flow:
    //   Stage 1: Job-details sidebar with a "Apply" button (this button just OPENS the modal)
    //   Stage 2: Center modal with textarea + "Send application" (this is the actual submit)
    // We must reach stage 2 before filling+submitting. Detect via "Send application" text.
    const pickInnermost = (arr) => arr.sort((a, b) => a.textContent.length - b.textContent.length)[0];
    const findRealModal = () => {
      const dialogs = [...document.querySelectorAll(SELECTORS.modal)];
      const real = dialogs.filter(isRealApplyModal);
      return real.length ? pickInnermost(real) : null;
    };

    const findSubmitButton = (root) => {
      const buttons = [...root.querySelectorAll('button, [type="submit"], a[role="button"]')]
        .filter((button) => button.getClientRects().length > 0);
      const strictSend = buttons.find((button) =>
        /^send application$|^submit application$|^send$/i.test(button.textContent.trim()));
      if (strictSend) return strictSend;

      const textarea = root.querySelector('textarea');
      const form = textarea?.closest('form');
      if (form) {
        return [...form.querySelectorAll('button, [type="submit"], a[role="button"]')]
          .find((button) => button.getClientRects().length > 0 && /^apply$/i.test(button.textContent.trim())) || null;
      }
      return null;
    };
    const findSidebarOverlay = () => {
      const dialogs = [...document.querySelectorAll(SELECTORS.modal)];
      const withApply = dialogs.filter((d) =>
        /apply to /i.test(d.textContent) &&
        [...d.querySelectorAll('button')].some((b) => visible(b) && SELECTORS.openerButtonText.test(b.textContent.trim())));
      return withApply.length ? pickInnermost(withApply) : null;
    };

    let modal = await waitFor(findRealModal, 5000);

    // Not open yet → we're on stage 1 (sidebar). Click its "Apply" opener to advance.
    if (!modal) {
      const sidebar = await waitFor(findSidebarOverlay, 5000);
      if (!sidebar) {
        log('  ⚠ no apply overlay found — skipping (not counting as sent)');
        return false;
      }
      // Location-gated jobs show "not accepting applications from your location" in the sidebar
      if (/not accepting applications from your (current )?location/i.test(sidebar.textContent)) {
        log('  🚫 location-blocked by company — skipping');
        findButtonByText(sidebar, /close|cancel|×/i)?.click();
        sidebar.querySelector('[aria-label="Close"]')?.click();
        return false;
      }
      const opener = findButtonByText(sidebar, SELECTORS.openerButtonText);
      if (!opener) {
        log('  ⚠ sidebar has no Apply opener — skipping');
        return false;
      }
      log('  ➡ stage 1: clicking sidebar Apply to open real modal');
      await trustedClick(opener);
      // Wellfound sometimes takes >10s to render the real modal (esp. jobs with
      // location-mismatch checks that fetch profile data). Poll for 25s.
      modal = await waitFor(findRealModal, 25000);
      if (!modal) {
        log('  ❌ real apply modal never appeared after clicking Apply — skipping');
        return false;
      }
      log('  ➡ stage 2: real apply modal opened');
      // Give the modal's form UI (radios, dropdowns, textareas) a beat to finish
      // painting before we start reading + filling it.
      await sleep(1200);
    } else {
      log('  ➡ real apply modal already open');
    }

    let scope = modal;
    // Wellfound's React re-renders the modal (replaces the DOM subtree) whenever
    // a radio/select changes state. After such actions our `scope` reference goes
    // stale (detached from DOM → all queries return elements with getClientRects()
    // === 0, i.e. "invisible"), and it looks like the modal vanished. Call this
    // after any interaction that might trigger a re-render.
    const refreshScope = () => {
      if (scope?.isConnected && isRealApplyModal(scope)) return scope;
      const fresh = findRealModal();
      if (fresh && fresh !== scope) scope = fresh;
      return scope;
    };
    refreshScope();

    const coverLetterText = coverLetter(company, title);
    const ensureCoverLetter = async () => {
      const textarea = await waitFor(() => {
        refreshScope();
        return [...scope.querySelectorAll('textarea')].find(visible) || null;
      }, 5000);
      if (!textarea) return false;

      if (textarea.value !== coverLetterText) {
        setValue(textarea, coverLetterText);
        await sleep(300);
      }

      refreshScope();
      const liveTextarea = [...scope.querySelectorAll('textarea')].find(visible);
      if (liveTextarea && liveTextarea.value !== coverLetterText) {
        setValue(liveTextarea, coverLetterText);
        await sleep(300);
      }

      refreshScope();
      return [...scope.querySelectorAll('textarea')]
        .some((field) => visible(field) && field.value === coverLetterText);
    };

    // Location-gated job ("X is not accepting applications from your current location…")
    // → Send is disabled, nothing we fill changes that. Skip immediately.
    if (/not accepting applications from your (current )?location/i.test(scope.textContent)) {
      log('  🚫 location-blocked by company — skipping');
      findButtonByText(scope, /close|cancel|×/i)?.click();
      scope.querySelector('[aria-label="Close"]')?.click();
      return false;
    }

    // 1. Cover letter: wait for the live textarea instead of sampling it once
    // while an already-open modal may still be rendering.
    if (await ensureCoverLetter()) {
      log('  ✍ cover letter filled');
    } else {
      log('  ⚠ cover letter textarea was not ready yet; will retry before submit');
    }

    // 2. Any extra question textareas/inputs — find their label text and answer from CV
    const textareas = [...scope.querySelectorAll('textarea')].filter(visible);
    const extraFields = [
      ...textareas.slice(1),
      ...[...scope.querySelectorAll('input[type="text"]:not([value])')].filter(visible),
    ];
    for (const field of extraFields) {
      const label = labelTextOf(field);
      if (/search/i.test(label)) continue; // page search box, not an application question
      const answer = await answerQuestion(label);
      // unknown question + optional field → leave blank rather than paste a generic paragraph
      const required = field.required || field.getAttribute('aria-required') === 'true' || /\*/.test(label);
      if (answer === GENERIC_ANSWER && !required) { log(`  ⏭ optional unknown question skipped: "${label.slice(0, 50)}"`); continue; }
      setValue(field, answer);
      log(`  ✍ answered: "${label.slice(0, 60)}..."`);
    }

    // 3a. Wellfound location-mismatch prompt:
    // "This job does not support the locations on your profile. … I am currently in… / I can relocate to…"
    // → pick "I can relocate to…", open its dropdown, choose the offered location.
    // Track which radios/selects section 3b must NOT touch (would flip React state
    // and undo section 3a's choices — Wellfound groups radios by React state, not
    // by native `name` attribute, so we track the actual DOM nodes here).
    const handledRadios = new Set();
    const handledSelects = new Set();
    let locationMismatch = false;
    refreshScope();
    if (/does not support the locations|update your location preferences/i.test(scope.textContent)) {
      locationMismatch = true;
      // Find the actual radio INPUT for "I can relocate to…". Search by the
      // label text that surrounds it, not by matching wrapper divs (clicking
      // a wrapper div doesn't toggle the radio in Wellfound's React app).
      let relocateRadio = [...scope.querySelectorAll('input[type="radio"]')]
        .find((r) => /i can relocate/i.test(labelTextOf(r)));
      // Also identify the sibling "I am currently in…" radio so section 3b won't click it
      const currentlyInRadio = [...scope.querySelectorAll('input[type="radio"]')]
        .find((r) => /i am currently in/i.test(labelTextOf(r)));
      if (relocateRadio) handledRadios.add(relocateRadio);
      if (currentlyInRadio) handledRadios.add(currentlyInRadio);
      // Fallback: some designs use role=radio instead of native inputs
      const relocateChoice = relocateRadio
        ? (relocateRadio.closest('label') ||
           (relocateRadio.id && document.querySelector(`label[for="${relocateRadio.id}"]`)) ||
           relocateRadio)
        : [...scope.querySelectorAll('label, [role="radio"]')]
            .filter((el) => el.getClientRects().length > 0)
            .find((el) => /i can relocate/i.test(el.textContent) && el.textContent.length < 80);

      if (relocateChoice) {
        // Click the visible native radio circle with a trusted CDP mouse event.
        // Do not assign `.checked` directly: that only changes a stale DOM node
        // and does not update Wellfound's React state.
        await trustedPointClick(relocateRadio || relocateChoice);
        await sleep(700);
        refreshScope();
        relocateRadio = [...scope.querySelectorAll('input[type="radio"]')]
          .find((r) => /i can relocate/i.test(labelTextOf(r)));
        if (!relocateRadio?.checked) {
          const liveLabel = relocateRadio && (relocateRadio.closest('label') ||
            (relocateRadio.id && document.querySelector(`label[for="${relocateRadio.id}"]`)));
          if (liveLabel) await trustedPointClick(liveLabel);
          await sleep(500);
          refreshScope();
          relocateRadio = [...scope.querySelectorAll('input[type="radio"]')]
            .find((r) => /i can relocate/i.test(labelTextOf(r)));
        }
        if (!relocateRadio?.checked) {
          log('  ⚠ could not select "I can relocate to…" with a real click — skipping this application');
          return false;
        }
        log('  📍 chose "I can relocate to…" (checked=true)');
        // Give React a full second to re-render the dropdown after the radio pick
        // (Wellfound only shows/enables it once "I can relocate to…" is selected)
        await sleep(1200);
        // React re-rendered the modal — re-fetch our scope reference or every
        // subsequent query will be against a detached DOM tree.
        refreshScope();
        // relocateRadio may now be detached too — re-find it in the fresh scope.
        relocateRadio = [...scope.querySelectorAll('input[type="radio"]')]
          .find((r) => /i can relocate/i.test(labelTextOf(r))) || relocateRadio;

        // The location picker next to it. Search order:
        //   1. Native <select>
        //   2. react-select / [role="combobox"]
        //   3. Any button/div near the relocate radio that visually looks like a
        //      dropdown trigger (contains "-", "Select", or is empty + has a chevron)
        let nativeSel = [...scope.querySelectorAll('select')].filter(visible).pop();
        let combo = [...scope.querySelectorAll('[role="combobox"], input[id*="react-select" i], [class*="select" i] input')]
          .filter(visible).pop();

        // Fallback #3: look for a custom trigger in the same section as the radio.
        // "Section" = closest fieldset / form-group / large parent up to the modal.
        let customTrigger = null;
        if (!nativeSel && !combo && relocateRadio) {
          const section =
            relocateRadio.closest('fieldset, form, [class*="location" i], [class*="mismatch" i], [class*="warning" i]') ||
            relocateRadio.parentElement?.parentElement?.parentElement ||
            scope;
          customTrigger = [...section.querySelectorAll('button, [role="button"], [aria-haspopup], input[readonly], div[tabindex], div[class*="select" i], div[class*="dropdown" i]')]
            .filter(visible)
            .find((el) => {
              if (el === relocateRadio || el.contains(relocateRadio)) return false;
              const t = el.textContent.trim();
              // Empty text with an SVG (chevron) OR literal "-" placeholder OR "Select..."
              return t === '-' || t === '' && el.querySelector('svg') || /^(select|choose|pick)/i.test(t);
            });
        }

        if (nativeSel) {
          handledSelects.add(nativeSel);
          const opts = [...nativeSel.options].filter((o) => o.value && !/select|choose|^-$/i.test(o.text.trim()));
          if (opts.length) { setValue(nativeSel, opts[0].value); log(`  📍 location: ${opts[0].text.trim()}`); }
        } else if (combo || customTrigger) {
          const trigger = combo || customTrigger;
          log(`  📍 opening dropdown: <${trigger.tagName.toLowerCase()}${trigger.className ? ' class="' + String(trigger.className).slice(0, 60) + '"' : ''}>`);
          await trustedClick(trigger, { force: true });
          await sleep(700);
          // options render in a portal at document root — search the whole document.
          // Skip options that are OBVIOUSLY unrelated (nav menu items etc.) by
          // preferring options within a dropdown-listbox container.
          const opt = await waitFor(
            () => {
              const listbox = [...document.querySelectorAll('[role="listbox"], [class*="menu" i][class*="option" i], [class*="dropdown" i][class*="menu" i]')]
                .filter(visible).pop();
              const container = listbox || document;
              return [...container.querySelectorAll('[role="option"], li[class*="option" i], div[class*="option" i]:not([class*="disabled" i])')]
                .find((el) => visible(el) && el.textContent.trim() && el.textContent.trim() !== '-');
            },
            4000
          );
          if (opt) { await trustedClick(opt, { force: true }); log(`  📍 location: ${opt.textContent.trim().slice(0, 40)}`); }
          else {
            // fallback: keyboard-select the first suggestion
            for (const key of ['ArrowDown', 'Enter']) {
              trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
              await sleep(300);
            }
            log('  📍 location picked via keyboard fallback');
          }
        } else {
          // Log diagnostic info so we can see what the DOM actually looks like
          const nearbyInteractive = [...(relocateRadio?.closest('fieldset, form, div[class*="warning" i]') || scope)
            .querySelectorAll('button, [role="button"], [role="combobox"], input, select, [tabindex]')]
            .filter(visible)
            .slice(0, 8)
            .map((el) => `<${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : ''}>"${el.textContent.trim().slice(0, 20)}"`)
            .join(' | ');
          log(`  ⚠ relocate chosen but no location dropdown found. nearby: ${nearbyInteractive || 'none'}`);
        }
        await sleep(500);
        // React may have re-rendered again after the location pick — refresh scope.
        refreshScope();
        // Re-verify relocate radio is still checked (React may have re-rendered)
        const freshRelocateRadio = [...scope.querySelectorAll('input[type="radio"]')]
          .find((r) => /i can relocate/i.test(labelTextOf(r)));
        if (freshRelocateRadio && !freshRelocateRadio.checked) {
          log('  ⚠ relocate radio unchecked after location pick — re-clicking');
          const target = freshRelocateRadio.closest('label') ||
            (freshRelocateRadio.id && document.querySelector(`label[for="${freshRelocateRadio.id}"]`)) ||
            freshRelocateRadio;
          await trustedClick(target, { force: true });
          await sleep(400);
        }
      }
    }

    // 3b. Dropdowns / radios / checkboxes — relocation, work-auth, location pickers etc.
    // Preference order: my city → my country → any "yes / willing / open to" style option.
    const YES = /yes|willing|open to|agree|relocat|remote|immediat|i am able|i can/i;
    const NO_PLACEHOLDER = /^select|^choose|^--|^pick/i;

    // Radios/checkboxes are often visually hidden inputs with a styled wrapping label.
    // Clicking the label (via the trusted-click bridge) is far more reliable.
    const clickTargetFor = (input) => input.closest('label') ||
      (input.id && document.querySelector(`label[for="${input.id}"]`)) || input;

    for (const sel of [...scope.querySelectorAll('select')].filter(visible)) {
      if (handledSelects.has(sel)) continue; // section 3a already picked its value
      if (sel.value && sel.value.trim() !== '' && sel.value !== '-') continue; // already answered
      const opts = [...sel.options].filter((o) => o.value && !NO_PLACEHOLDER.test(o.text.trim()));
      if (!opts.length) continue;
      // "Yes / willing to relocate" wins first; for location pickers, whatever
      // location the job lists is fine (opts[0] is the job's own location) —
      // never leave a location/relocation dropdown unanswered.
      const pick =
        opts.find((o) => YES.test(o.text)) ||
        opts.find((o) => CV.location && o.text.toLowerCase().includes(CV.location.split(',')[0].trim().toLowerCase())) ||
        opts[0];
      setValue(sel, pick.value);
      log(`  ☑ selected "${pick.text.trim()}" for "${labelTextOf(sel).slice(0, 50)}"`);
    }

    const radioGroups = {};
    for (const r of [...scope.querySelectorAll('input[type="radio"]')]) {
      // Skip anything section 3a touched (Wellfound's location-mismatch radios
      // share React state without an HTML `name`, so clicking a sibling would
      // uncheck our chosen radio and can even close the modal).
      if (handledRadios.has(r)) continue;
      // Extra guard: never touch relocation/currently-in radios even if section
      // 3a didn't run (e.g. text pattern didn't match this variant).
      const lbl = labelTextOf(r);
      if (/i can relocate|i am currently in/i.test(lbl)) continue;
      // include invisible inputs — many designs hide the native input behind a styled label
      (radioGroups[r.name || lbl] ||= []).push(r);
    }
    for (const [, group] of Object.entries(radioGroups)) {
      if (group.some((r) => r.checked)) continue; // something already selected
      const groupCtx = (group[0].closest('fieldset')?.textContent || group.map((r) => labelTextOf(r)).join(' ')).slice(0, 200);
      let pick = null;
      if (/gender|^sex\b/i.test(groupCtx)) {
        pick = group.find((r) => { const l = labelTextOf(r); return /male/i.test(l) && !/female/i.test(l); });
      } else if (/disability|disabled/i.test(groupCtx)) {
        pick = group.find((r) => /no disability|not disabled|^no\b|none/i.test(labelTextOf(r)));
      }
      pick = pick || group.find((r) => YES.test(labelTextOf(r))) || group[0];
      await trustedClick(clickTargetFor(pick), { force: true });
      log(`  ☑ radio "${labelTextOf(pick).slice(0, 50)}"`);
    }

    for (const cb of [...scope.querySelectorAll('input[type="checkbox"]')]) {
      const own = labelTextOf(cb);
      // Question text around the checkbox group (fieldset legend or nearby container)
      const groupText = (cb.closest('fieldset')?.querySelector('legend')?.textContent ||
                         cb.closest('fieldset, [role="group"]')?.textContent || '').trim();
      const isLocationQuestion = /relocat|locat|city|office|work from|based in|move to/i.test(groupText);
      // Tick if: it's an agree/authorize/relocate box, OR it belongs to a location
      // question — any city the job lists is fine, I'll relocate there.
      // Still never blind-check unrelated boxes (newsletters etc.).
      if (!cb.checked &&
          (isLocationQuestion || /relocat|agree|confirm|authoriz|terms|acknowledge|remote/i.test(own))) {
        await trustedClick(clickTargetFor(cb), { force: true });
        log(`  ☑ checked "${own.slice(0, 50)}"`);
      }
    }

    // Radio/dropdown changes can replace or reset the React-controlled textarea.
    // Refill and verify the live form immediately before looking for Submit.
    if (!await ensureCoverLetter()) {
      log('  🚫 cover letter is still empty after retry — skipping instead of submitting blank');
      return false;
    }
    log('  ✍ cover letter verified before submit');

    // 4. Send — poll for it, the modal sometimes renders the button late.
    // Also refresh scope inside the poll — React may re-render the modal each time
    // a form field's value changes, invalidating our stored `scope` reference.
    const sendBtn = await waitFor(() => {
      refreshScope();
      return findSubmitButton(scope);
    }, 12000);
    if (!sendBtn) {
      // tell "button exists but disabled" (blocked application) apart from "selector miss"
      const disabledBtn = [...scope.querySelectorAll('button, [type="submit"]')]
        .find((b) => SELECTORS.sendButtonText.test(b.textContent.trim()) && b.disabled);
      log(disabledBtn
        ? '  🚫 Send button is disabled (application blocked) — skipping'
        : '  ⚠ no Send button found after waiting — skipping');
      findButtonByText(scope, /close|cancel|×/i)?.click();
      scope.querySelector('[aria-label="Close"]')?.click();
      return false;
    }
    if (CONFIG.DRY_RUN) {
      log('  🔍 DRY_RUN — would click:', sendBtn.textContent.trim());
      // close the modal so the loop can continue
      findButtonByText(scope, /close|cancel|×/i)?.click();
      scope.querySelector('[aria-label="Close"]')?.click();
      return true;
    }

    // Robust click using the shared trustedClick helper (Playwright locator bridge if available).
    const submitLabel = sendBtn.textContent.trim();
    await trustedClick(sendBtn);
    log(`  ⏳ clicked ${submitLabel}, waiting for confirmation...`);

    // VERIFY the submission actually went through. Wellfound gives one of:
    //   - modal closes / textarea disappears
    //   - success text ("application sent", "thanks for applying", etc.) appears
    //   - the button becomes disabled + spinner + then closes
    // If neither happens in 15s, the click didn't submit — do NOT count it as sent.
    const submitted = await waitFor(() => {
      if (!scope.isConnected) return true;
      if (!scope.querySelector('textarea')) return true; // modal replaced with success view
      if (/application (has been )?sent|thanks for applying|successfully applied|application submitted|we'?ll be in touch/i
            .test(scope.textContent)) return true;
      return false;
    }, 15000);

    if (!submitted) {
      log('  ❌ clicked Send but no confirmation appeared — NOT counting as sent');
      // Diagnostic: what does the modal say now? Look for validation errors,
      // required fields, or hidden overlays that might be blocking submit.
      const modalText = (scope.textContent || '').replace(/\s+/g, ' ').trim();
      const errorHint = (modalText.match(/(please|required|error|invalid|must|missing|fix|complete)[^.!?]{0,120}/i) || [])[0];
      log('  📋 modal text (first 300 chars):', modalText.slice(0, 300));
      if (errorHint) log('  ⚠ possible validation issue:', errorHint);
      // Check if the send button we clicked is now disabled or gone
      const stillThere = scope.contains(sendBtn) && sendBtn.isConnected;
      log('  🔎 send button still in DOM:', stillThere, '| disabled:', sendBtn.disabled);
      findButtonByText(scope, /close|cancel|×/i)?.click();
      scope.querySelector('[aria-label="Close"]')?.click();
      return false;
    }
    log('  ✅ application sent (confirmed)');
    return true;
  }

  // ======================= MAIN LOOP =======================
  const titleOk = (t) => {
    const lower = t.toLowerCase();
    return CONFIG.TITLE_KEYWORDS.some((k) => lower.includes(k)) &&
           !CONFIG.TITLE_BLOCKLIST.some((k) => lower.includes(k));
  };

  // 2026 UI: job cards no longer carry an Apply button. Clicking the job link opens
  // an SPA overlay (URL gains ?job_listing_slug=…) with the "Apply to <Company>"
  // panel — a client-side route change, so this pasted script keeps running.
  function findJobRows() {
    const rows = [];
    for (const a of document.querySelectorAll('a[href*="/jobs/"]')) {
      // real job links look like /jobs/4491644-some-slug (nav "Jobs" link has no id)
      if (!/\/jobs\/\d/.test(a.getAttribute('href') || '')) continue;
      if (!visible(a) || a.textContent.trim().length < 4) continue;
      let row = a.closest('div');
      for (let i = 0; i < 5 && row && row.textContent.trim().length < 60; i++) row = row.parentElement;
      row = row || a.parentElement;
      // already applied? the card shows an "Applied" stamp
      if (SELECTORS.alreadyApplied.test([...row.querySelectorAll('button, span')].map((e) => e.textContent.trim()).find((t) => /^applied$/i.test(t)) || '')) continue;
      const company = (row.querySelector('img[alt*="logo" i]')?.alt || '')
        .replace(/company logo/i, '').trim();
      const salary = (row.textContent.match(/(?:₹|\$|€)\s?[\d.,k]+\s?(?:[–-]\s?(?:₹|\$|€)?\s?[\d.,k]+)?k?/i) || [''])[0].trim();
      rows.push({ href: a.href, title: cleanTitle(a.textContent), company, salary, linkEl: a });
    }
    return rows;
  }

  function findJobFeedScroller(rows) {
    let el = rows[0]?.linkEl?.parentElement;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 100) {
        return el;
      }
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  async function scrollJobFeed(seen) {
    const beforeRows = findJobRows();
    const before = new Set(beforeRows.map((job) => job.href));
    const scroller = findJobFeedScroller(beforeRows);

    if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
      window.scrollTo(0, scroller.scrollHeight);
    } else {
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    }

    await sleep(3000);
    const afterRows = findJobRows();
    return {
      newCards: afterRows.some((job) => !before.has(job.href)),
      matchingJob: afterRows.some((job) => !seen.has(job.href) && titleOk(job.title)),
      scroller: scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body
        ? 'window'
        : `${scroller.tagName.toLowerCase()}.${String(scroller.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')}`,
    };
  }

  // When the current page runs out of matching jobs, hop to these Wellfound
  // search pages (remote + all-location role pages). Navigation uses Wellfound's
  // own Next.js router (window.next.router) — a client-side route change, so
  // this pasted script KEEPS RUNNING across pages. A bad/404 slug just yields
  // zero jobs and we move on to the next one.
  // /role/* pages render empty for logged-in sessions (verified Jul 2026) — the
  // /jobs feed with infinite scroll is the real inventory. /location/india as backup.
  // '/location/india' removed: job clicks there are FULL navigations (no SPA
  // overlay) — the script dies, gets re-injected each page, and phantom-applied
  // to the same jobs in a loop (2026-08-06). /jobs infinite scroll only.
  const SEARCH_PAGES = ['/jobs'];
  // after a full page load onto one of the search pages, resume from the NEXT one —
  // restarting at 0 would reload the same page forever
  let searchIdx = SEARCH_PAGES.indexOf(location.pathname) + 1;

  async function goToNextSearchPage() {
    if (searchIdx >= SEARCH_PAGES.length) return false;
    const url = SEARCH_PAGES[searchIdx++];
    log(`🌐 Moving to next search page: ${url}`);
    if (window.next?.router?.push) {
      window.next.router.push(url);
    } else {
      log('⚠ SPA router not found — doing a full page load. PASTE THE SCRIPT AGAIN after the page loads to continue.');
      location.href = url;
      return false; // script dies on full reload; user re-pastes
    }
    await sleep(6000); // let the new results render
    window.scrollTo(0, 400);
    return true;
  }

  let applied = 0;
  const seenKey = '__aaWellfoundSeen';
  let storedSeen = [];
  try { storedSeen = JSON.parse(sessionStorage.getItem(seenKey) || '[]'); } catch (e) {}
  const seen = new Set(Array.isArray(storedSeen) ? storedSeen : []);
  const rememberSeen = (href) => {
    seen.add(href);
    try { sessionStorage.setItem(seenKey, JSON.stringify([...seen].slice(-2000))); } catch (e) {}
  };

  log(`Starting. DRY_RUN=${CONFIG.DRY_RUN}, max=${CONFIG.MAX_APPLICATIONS}`);
  log('Tip: keep this tab focused and do not navigate away.');
  await sleep(5000); // job cards render after load — don't declare the page empty too early

  while (applied < CONFIG.MAX_APPLICATIONS) {
    const allRows = findJobRows();
    const jobs = allRows.filter((j) => !seen.has(j.href) && titleOk(j.title));

    if (!jobs.length) {
      // Diagnostics so failures are debuggable from the console output
      log(`(this page: ${allRows.length} job cards found, 0 match filters` +
          (allRows.length ? ` — sample titles: ${allRows.slice(0, 3).map((j) => `"${j.title}"`).join(', ')}` : '') + ')');

      // Try to load more results on this page first
      const more = findButtonByText(document, /load more|show more/i); // "next" is too generic — could hit a form's Next button
      if (more) { more.click(); await sleep(3000); continue; }
      // Infinite-scroll feed: Wellfound usually puts cards in a nested scrolling
      // panel, so scrolling `window` alone keeps returning the same 11–13 cards.
      let grew = false;
      for (let s = 0; s < 12 && !grew; s++) {
        const result = await scrollJobFeed(seen);
        if (s === 0) log(`  ↳ scrolling job feed via ${result.scroller}`);
        grew = result.matchingJob;
        if (!result.newCards && !result.matchingJob && s >= 2) break;
      }
      if (grew) continue;

      // Page exhausted → search globally across role pages
      if (await goToNextSearchPage()) continue;
      log('All search pages exhausted. Done.');
      break;
    }

    const job = jobs[0];
    rememberSeen(job.href);
    log(`▶ Applying: ${job.title} @ ${job.company || '?'} | ${job.href} | ${job.salary || ''}`);
    job.linkEl.scrollIntoView({ block: 'center' });
    await sleep(500);
    job.linkEl.click(); // SPA overlay opens with the "Apply to <Company>" panel
    await sleep(3000);

    const ok = await fillAndSubmit(job.company || getCompany(), job.title);
    if (ok) {
      applied++;
      log(`  progress: ${applied}/${CONFIG.MAX_APPLICATIONS}`);
    }
    // close the job overlay (top-right ✕) so the next card is clickable
    await sleep(1000);
    (document.querySelector('button[aria-label="Close" i], [class*="Modal" i] button[class*="close" i]') ||
      findButtonByText(document, /^×$|^✕$/))?.click();
    await sleep(1000);
    await humanDelay();
  }

  log(`Finished. ${CONFIG.DRY_RUN ? 'DRY RUN — nothing was actually sent. Set CONFIG.DRY_RUN = false and re-run to apply for real.' : `Applied to ${applied} jobs.`}`);
})();
