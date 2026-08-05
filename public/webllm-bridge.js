// WebLLM bridge — on-device ARC cycle (Tier 3)
(function() {
  'use strict';

  const ARC_SYSTEM = {
    analysis: `Analyze coding requests. Output ONLY JSON.
Format: {"type":"bug_fix|feature|refactor|new_project","language":"detected","complexity":"simple|moderate|complex","summary":"one sentence summary"}`,

    plan: `Create step-by-step plans. Output ONLY JSON.
Format: {"steps":[{"step":1,"action":"create|modify|delete","file":"filename","description":"what to do"}]}`,

    code: `Write complete working code. Output ONLY JSON.
Format: {"files":[{"path":"filename","content":"complete code","description":"purpose"}],"setup":"any setup commands","explanation":"how to use"}`,

    review: `Review code quality. Score 0.0 to 1.0. Output ONLY JSON.
Format: {"score":0.85,"passed":true,"issues":[{"severity":"critical|major|minor","file":"filename","problem":"what","fix":"how"}],"summary":"brief"}`,

    refine: `Fix code based on review. Output ONLY JSON in same format as original code.`
  };

  const QUALITY_THRESHOLD = 0.80;
  const MAX_REVIEW_LOOPS = 2;

  window.onDeviceMode = localStorage.getItem('lighthouse_ondevice') === 'true';
  window.lighthouseOnDevice = null;

  function parseJSON(text) {
    if (!text || typeof text !== 'string') return null;
    let cleaned = text
      .replace(/```\w*\n?/g, '')
      .replace(/```/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    cleaned = cleaned.slice(start, end + 1)
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    try { return JSON.parse(cleaned); } catch {}
    return null;
  }

  async function ensureModel() {
    if (!window.OnDeviceModel) throw new Error('WebLLM not loaded');
    if (!window.lighthouseOnDevice) {
      window.lighthouseOnDevice = new OnDeviceModel();
    }
    if (!window.lighthouseOnDevice.ready) {
      const msgId = typeof addMsg === 'function'
        ? addMsg('🧠 Loading on-device model (~2GB, one-time)...', 'system')
        : null;
      await window.lighthouseOnDevice.init((pct, text) => {
        if (msgId && typeof addMsg === 'function') {
          const el = document.getElementById(msgId);
          if (el) el.innerHTML = `🧠 Loading on-device model: ${pct}%<br><small>${text}</small>`;
        }
      });
      if (msgId && typeof addMsg === 'function') {
        addMsg('✅ On-device model ready', 'system');
      }
    }
    return window.lighthouseOnDevice;
  }

  window.handleARCOnDevice = async function(request) {
    const model = await ensureModel();
    const startTime = Date.now();
    const stages = ['analysis', 'plan', 'code', 'review'];

    if (typeof setStage === 'function') {
      setStage('analysis', 'waiting');
      stages.slice(1).forEach(s => setStage(s, 'waiting'));
    }

    setStage('analysis', 'active');
    const analysisRaw = await model.generate(
      `Request: ${request}\nAnalyze:`,
      ARC_SYSTEM.analysis
    );
    const analysis = parseJSON(analysisRaw) || { type: 'unknown', summary: request };
    setStage('analysis', 'done');

    setStage('plan', 'active');
    const planRaw = await model.generate(
      `Task: ${request}\nAnalysis: ${JSON.stringify(analysis)}\nCreate plan:`,
      ARC_SYSTEM.plan
    );
    const plan = parseJSON(planRaw) || { steps: [] };
    setStage('plan', 'done');
    if (plan.steps?.length && typeof addMsg === 'function') {
      addMsg('<b>📋 Plan:</b><br>' + plan.steps.map(s => `${s.step}. ${s.description}`).join('<br>'), 'agent');
    }

    setStage('code', 'active');
    const codeRaw = await model.generate(
      `Plan: ${JSON.stringify(plan)}\nWrite code:`,
      ARC_SYSTEM.code
    );
    let code = parseJSON(codeRaw) || { files: [], explanation: codeRaw };
    setStage('code', 'done');

    if (code.files?.length && typeof addMsg === 'function') {
      window.currentFiles = code.files;
      let html = '<b>💻 Generated Files (on-device):</b><br>';
      code.files.forEach(f => { html += `<br><b>📄 ${f.path}</b> — ${f.description || ''}<br>`; });
      const mid = addMsg(html, 'agent');
      const btns = document.createElement('div');
      btns.className = 'btns';
      code.files.forEach(f => {
        const b = document.createElement('button');
        b.textContent = '👁 ' + f.path;
        b.onclick = () => viewFile(f);
        btns.appendChild(b);
        const d = document.createElement('button');
        d.textContent = '⬇️';
        d.onclick = () => downloadFile(f);
        btns.appendChild(d);
      });
      document.getElementById(mid).appendChild(btns);
    }

    setStage('review', 'active');
    let review = { score: 0.8, passed: true, issues: [], loops: 0 };
    let loops = 0;

    do {
      const reviewRaw = await model.generate(
        `Code: ${JSON.stringify(code)}\nPlan: ${JSON.stringify(plan)}\nReview:`,
        ARC_SYSTEM.review
      );
      review = parseJSON(reviewRaw) || review;

      if (!review.passed && review.score < QUALITY_THRESHOLD && loops < MAX_REVIEW_LOOPS) {
        if (typeof addMsg === 'function') addMsg('🔄 Refining code based on review...', 'system');
        const refinedRaw = await model.generate(
          `Code: ${JSON.stringify(code)}\nIssues: ${JSON.stringify(review.issues)}\nFix:`,
          ARC_SYSTEM.refine
        );
        const refined = parseJSON(refinedRaw);
        if (refined) code = refined;
        loops++;
      } else {
        break;
      }
    } while (loops < MAX_REVIEW_LOOPS);

    review.loops = loops;
    setStage('review', 'done');

    if (typeof addMsg === 'function') {
      const pct = ((review.score || 0.8) * 100).toFixed(0);
      addMsg(`<b>🔍 Review:</b> ${pct}% ✅ (${loops} refinements) — on-device`, 'agent');
      const elapsed = Date.now() - startTime;
      addMsg(`⏱️ ${(elapsed / 1000).toFixed(1)}s (on-device)`, 'system');
      setTimeout(() => stages.forEach(s => setStage(s, '')), 2000);
    }
  };

  async function initOnDeviceUI() {
    const supported = window.OnDeviceModel && await OnDeviceModel.isSupported();
    if (!supported) return;

    const header = document.querySelector('header .status');
    if (!header || document.getElementById('onDeviceBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'onDeviceBtn';
    btn.type = 'button';
    btn.title = 'Run AI on this device (WebGPU)';
    btn.style.cssText = 'background:var(--s2);border:1px solid var(--b);color:var(--t2);border-radius:12px;padding:4px 8px;font-size:11px;cursor:pointer;margin-right:6px;';
    btn.textContent = window.onDeviceMode ? '🧠 On-Device' : '☁️ Server';
    btn.onclick = async () => {
      if (!window.onDeviceMode) {
        btn.disabled = true;
        btn.textContent = '⏳ Loading...';
        try {
          window.onDeviceMode = true;
          localStorage.setItem('lighthouse_ondevice', 'true');
          await ensureModel();
          btn.textContent = '🧠 On-Device';
          if (typeof addMsg === 'function') {
            addMsg('🧠 On-device AI enabled. Requests run locally on your phone.', 'system');
          }
        } catch (err) {
          window.onDeviceMode = false;
          localStorage.setItem('lighthouse_ondevice', 'false');
          btn.textContent = '☁️ Server';
          if (typeof addMsg === 'function') addMsg('❌ On-device model failed: ' + err.message, 'system');
        }
        btn.disabled = false;
      } else {
        window.onDeviceMode = false;
        localStorage.setItem('lighthouse_ondevice', 'false');
        btn.textContent = '☁️ Server';
        if (typeof addMsg === 'function') addMsg('☁️ Switched to server mode.', 'system');
      }
    };

    header.insertBefore(btn, header.firstChild);

    if (window.onDeviceMode) {
      ensureModel().catch(() => {
        window.onDeviceMode = false;
        localStorage.setItem('lighthouse_ondevice', 'false');
        btn.textContent = '☁️ Server';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnDeviceUI);
  } else {
    initOnDeviceUI();
  }
})();
