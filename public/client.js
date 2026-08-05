const API = '/api';
let busy = false, currentFiles = [], viewedFile = null, currentProject = null;

async function init() {
  const saved = localStorage.getItem('lighthouse_project');
  if (saved) currentProject = saved;

  document.getElementById('inp').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  checkHealth();
  setInterval(checkHealth, 15000);
}

function checkHealth() {
  fetch(API + '/health')
    .then(r => r.json())
    .then(d => {
      const dot = document.getElementById('dot'), txt = document.getElementById('statusText');
      if (d.status === 'ready') {
        dot.className = 'online';
        txt.textContent = (d.backend || 'ready') + ' • ' + (d.requests || 0) + ' req';
      } else if (!d.modelExists && d.backend === 'mock') {
        dot.className = 'online';
        txt.textContent = 'Learning mode';
      } else {
        dot.className = 'loading';
        txt.textContent = 'Loading...';
      }
    })
    .catch(() => {
      document.getElementById('dot').className = 'offline';
      document.getElementById('statusText').textContent = 'Offline';
    });
}

async function send() {
  if (busy) return;
  const inp = document.getElementById('inp'), text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  busy = true;
  document.getElementById('sendBtn').disabled = true;
  addMsg(text, 'user');

  if (text.match(/^idea:?\s/i) || text.match(/^i have an idea/i)) {
    const idea = text.replace(/^idea:?\s*/i, '').replace(/^i have an idea:?\s*/i, '');
    await handleIdea(idea);
  } else {
    await handleARC(text);
  }

  busy = false;
  document.getElementById('sendBtn').disabled = false;
  inp.focus();
}

async function handleARC(request) {
  const stages = ['analysis', 'plan', 'code', 'review'];
  setStage('analysis', 'waiting');
  stages.slice(1).forEach(s => setStage(s, 'waiting'));

  const res = await fetch(API + '/arc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request })
  });

  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();

    for (const line of lines) {
      if (line.startsWith('event: ')) continue;
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.stage) {
            setStage(data.stage.stage,
              data.stage.status === 'done' ? 'done' :
              data.stage.status === 'refining' ? 'active' : 'active');
            if (data.stage.status === 'refining') {
              addMsg('🔄 Refining code based on review...', 'system');
            }
          }

          if (data.plan?.steps) {
            addMsg('<b>📋 Plan:</b><br>' +
              data.plan.steps.map(s => `${s.step}. ${s.description}`).join('<br>'),
              'agent');
          }

          if (data.code?.files) {
            currentFiles = data.code.files;
            let html = '<b>💻 Generated Files:</b><br>';
            data.code.files.forEach(f => {
              html += `<br><b>📄 ${f.path}</b> — ${f.description || ''}<br>`;
            });
            const mid = addMsg(html, 'agent');
            const btns = document.createElement('div');
            btns.className = 'btns';

            data.code.files.forEach(f => {
              const b = document.createElement('button');
              b.textContent = '👁 ' + f.path;
              b.onclick = () => viewFile(f);
              btns.appendChild(b);

              const d = document.createElement('button');
              d.textContent = '⬇️';
              d.onclick = () => downloadFile(f);
              btns.appendChild(d);
            });

            const s = document.createElement('button');
            s.textContent = '💾 Save All';
            s.onclick = () => saveProject();
            btns.appendChild(s);

            document.getElementById(mid).appendChild(btns);
          }

          if (data.review?.score) {
            const pct = (data.review.score * 100).toFixed(0);
            addMsg(`<b>🔍 Review:</b> ${pct}% ${data.review.passed ? '✅' : '⚠️'} (${data.review.loops || 0} refinements)`, 'agent');
          }

          if (data.elapsed) {
            addMsg(`⏱️ ${(data.elapsed / 1000).toFixed(1)}s`, 'system');
            setTimeout(() => {
              ['analysis', 'plan', 'code', 'review'].forEach(s => setStage(s, ''));
            }, 2000);
          }
        } catch {}
      }
    }
  }
}

async function handleIdea(idea) {
  const res = await fetch(API + '/idea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  const d = await res.json();
  let t = `<b>💡 ${d.suggestedName || 'Project'}</b><br><br>${d.explanation}<br><br><b>To build this, tell me:</b><br>`;
  d.questions?.forEach((q, i) => { t += `${i + 1}. ${q}<br>`; });
  t += '<br><em>Answer these and I will build it.</em>';
  addMsg(t, 'agent');
  document.getElementById('inp').value = 'Answers:\n1. ';
  document.getElementById('inp').focus();
}

function viewFile(f) {
  viewedFile = f;
  document.getElementById('codeTitle').textContent = '💻 ' + f.path;
  document.getElementById('codeContent').textContent = f.content;
  document.getElementById('codePanel').classList.add('open');
}

function downloadFile(f) {
  const b = new Blob([f.content], { type: 'text/plain' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u;
  a.download = f.path.split('/').pop();
  a.click();
  URL.revokeObjectURL(u);
}

function downloadCode() {
  if (viewedFile) downloadFile(viewedFile);
  else alert('Click a file first to view it, then download.');
}

async function saveProject() {
  const n = prompt('Project name:', currentProject || 'my-project');
  if (!n) return;
  currentProject = n;
  localStorage.setItem('lighthouse_project', n);

  const files = {};
  currentFiles.forEach(f => { files[f.path] = f.content; });
  await fetch(API + '/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: n, files })
  });
  addMsg('✅ Saved!', 'system');
}

function addMsg(text, role) {
  const chat = document.getElementById('chat'), div = document.createElement('div');
  div.className = 'msg ' + role;
  div.id = 'm' + Date.now();
  div.innerHTML = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/\n/g, '<br>');
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div.id;
}

function setStage(stage, state) {
  const el = document.querySelector(`.stage[data-s="${stage}"]`);
  if (!el) return;
  el.classList.remove('active', 'done', 'waiting');
  if (state === 'active') el.classList.add('active');
  else if (state === 'done') el.classList.add('done');
  else if (state === 'waiting') el.classList.add('waiting');
}

function idea() {
  document.getElementById('inp').value = 'I have an idea: ';
  document.getElementById('inp').focus();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('inp').focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProject();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

init();
