#!/usr/bin/env node
/*
  LIGHTHOUSE v1.0.1 — All 6 audit fixes applied

  Fixes applied:
    M1: Stage pills clear after ARC completion (client.js)
    M2: CLI timeout + progress indicator (core.js)
    M3: Atomic download with .tmp file + resume (setup.js)
    m1: Service worker created (public/sw.js)
    m2: localStorage project restore (client.js)
    m4: \x7F added to parseJSON regex (core.js)
*/

const express = require('express');
const { spawn, execSync } = require('child_process');
const {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync,
  statSync, appendFileSync
} = require('fs');
const { join, basename, extname } = require('path');
const { mountFrontierRoutes } = require('./lib/frontier');
const { attachFrontierToArcResult } = require('./lib/frontier-codegen');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const PORT = 8899;
const MODEL_DIR = join(__dirname, 'models');
const PROJECT_DIR = join(__dirname, 'projects');
const PUBLIC_DIR = join(__dirname, 'public');
const MODEL_FILE = join(MODEL_DIR, 'model.gguf');
const MAX_REVIEW_LOOPS = 2;
const QUALITY_THRESHOLD = 0.80;
const TEMPERATURE = 0.1;
const MAX_TOKENS = 2048;
const THREADS = Math.max(1, (require('os').cpus().length || 2) - 1);
const CLI_TIMEOUT = 300000;

const T_IM_START = '<' + '|im_start|>';
const T_IM_END = '<' + '|im_end|>';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let backend = null;
let modelReady = false;
let modelProcess = null;
let stats = { requests: 0, tokens: 0, errors: 0, startTime: Date.now() };

// ═══════════════════════════════════════════════════════════════
// ENSURE DIRECTORIES
// ═══════════════════════════════════════════════════════════════
[MODEL_DIR, PROJECT_DIR, PUBLIC_DIR].forEach(d => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

// ═══════════════════════════════════════════════════════════════
// MODEL BACKEND DETECTION & MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function detectBackend() {
  try {
    const res = await fetch('http://127.0.0.1:8080/health', {
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      console.log('✅ Found running llama-server on port 8080');
      backend = 'server';
      modelReady = true;
      return;
    }
  } catch {}

  const serverBinary = await findBinary(['llama-server', 'server', 'llama.cpp-server']);
  if (serverBinary && existsSync(MODEL_FILE)) {
    console.log(`🧠 Starting model server (${basename(serverBinary)})...`);
    modelProcess = spawn(serverBinary, [
      '-m', MODEL_FILE,
      '--host', '127.0.0.1',
      '--port', '8080',
      '-t', String(THREADS),
      '-c', '4096',
      '-ngl', '0'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    modelReady = await waitForServer('http://127.0.0.1:8080/health', 60000);
    if (modelReady) {
      backend = 'server';
      console.log('✅ Model server ready\n');
      return;
    }
  }

  const cliBinary = await findBinary(['llama-cli', 'llama', 'main', 'llama.cpp']);
  if (cliBinary && existsSync(MODEL_FILE)) {
    console.log(`🧠 Using CLI backend (${basename(cliBinary)}) — slower but works`);
    backend = 'cli';
    modelReady = true;
    console.log('✅ CLI backend ready\n');
    return;
  }

  console.log('💡 No model found. Running in LEARNING MODE.');
  console.log('   The agent will explain concepts and show examples.');
  console.log('   Run: node setup.js   to download a model.\n');
  backend = 'mock';
  modelReady = true;
}

async function findBinary(names) {
  for (const name of names) {
    try {
      let result = '';
      if (process.platform === 'win32') {
        try {
          result = execSync(`where ${name} 2>NUL`, {
            encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
          }).trim().split('\n')[0];
        } catch {}
      } else {
        try {
          result = execSync(`command -v ${name} 2>/dev/null`, {
            encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
          }).trim();
        } catch {}
      }

      if (result && existsSync(result)) {
        try {
          const help = execSync(`"${result}" --help 2>&1 || true`, {
            encoding: 'utf-8', timeout: 3000,
            stdio: ['ignore', 'pipe', 'ignore']
          });
          if (help.includes('-m') && (help.includes('model') || help.includes('llama'))) {
            return result;
          }
        } catch {
          return result;
        }
      }
    } catch {}
  }
  return null;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {}
    await sleep(1000);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// MODEL INFERENCE
// ═══════════════════════════════════════════════════════════════

async function generate(prompt, system = '', streamCallback = null) {
  switch (backend) {
    case 'server': return generateViaServer(prompt, system, streamCallback);
    case 'cli': return generateViaCLI(prompt, system, streamCallback);
    case 'mock': return generateMock(prompt, system);
    default: throw new Error('No backend available');
  }
}

async function generateViaServer(prompt, system, streamCallback) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      stream: !!streamCallback,
      stop: [T_IM_END, T_IM_START]
    })
  });

  if (streamCallback) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const token = json.choices?.[0]?.delta?.content || '';
            fullText += token;
            streamCallback(token);
          } catch {}
        }
      }
    }
    return fullText;
  } else {
    const data = await res.json();
    stats.tokens += data.usage?.total_tokens || 0;
    return data.choices[0].message.content;
  }
}

async function generateViaCLI(prompt, system, streamCallback) {
  let fullPrompt = '';
  if (system) fullPrompt += `${T_IM_START}system\n${system}${T_IM_END}\n`;
  fullPrompt += `${T_IM_START}user\n${prompt}${T_IM_END}\n${T_IM_START}assistant\n`;

  const binary = await findBinary(['llama-cli', 'llama', 'main', 'llama.cpp']);

  return new Promise((resolve, reject) => {
    const proc = spawn(binary, [
      '-m', MODEL_FILE,
      '-p', fullPrompt,
      '-n', String(MAX_TOKENS),
      '--temp', String(TEMPERATURE),
      '-t', String(THREADS),
      '-c', '4096',
      '--no-display-prompt',
      '--simple-io'
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });

    let output = '';
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (streamCallback) streamCallback(text);
    });
    proc.on('close', (code) => {
      if (code !== 0 && !output) reject(new Error(`CLI backend exited ${code}`));
      else resolve(output.trim());
    });
    proc.on('error', reject);
  });
}

function generateMock(prompt, system) {
  const stage = system.startsWith('Analyze') ? 'analysis' :
                system.startsWith('Create step') ? 'plan' :
                system.startsWith('Write complete') ? 'code' :
                system.startsWith('Review code') ? 'review' :
                system.startsWith('Fix code') ? 'code' :
                'analysis';

  const mockResponses = {
    analysis: JSON.stringify({
      type: 'new_project', language: 'javascript', complexity: 'moderate',
      summary: 'This appears to be a new project request. Lighthouse is in learning mode.'
    }),
    plan: JSON.stringify({
      steps: [
        { step: 1, action: 'create', file: 'index.html', description: 'Create main HTML file' },
        { step: 2, action: 'create', file: 'style.css', description: 'Add styles' },
        { step: 3, action: 'create', file: 'app.js', description: 'Add JavaScript logic' }
      ]
    }),
    code: JSON.stringify({
      files: [{
        path: 'example.html',
        content: `<!-- LIGHTHOUSE LEARNING MODE -->
<!-- Download a model for real code generation: node setup.js -->
<!DOCTYPE html><html><head><title>My Project</title></head>
<body><h1>Your Project Starts Here</h1>
<p>This is a template. With a model, AI will write real code.</p>
</body></html>`,
        description: 'Template — real generation requires a model'
      }],
      setup: 'Run: node setup.js  to download a free AI model (~4GB)',
      explanation: 'Learning mode active. Download a model for custom code generation.'
    }),
    review: JSON.stringify({
      score: 1.0, passed: true, issues: [],
      summary: 'Learning mode — no code to review.'
    })
  };

  return mockResponses[stage] || JSON.stringify({
    message: 'Learning mode active. Run: node setup.js'
  });
}

// ═══════════════════════════════════════════════════════════════
// ARC PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ARC CYCLE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

async function runARCCycle(request, context = {}, streamCallback = null) {
  const startTime = Date.now();
  stats.requests++;

  function emit(event, data) {
    if (streamCallback) streamCallback(event, data);
  }

  emit('stage', { stage: 'analysis', status: 'running' });
  const analysisRaw = await generate(
    `Request: ${request}\nFiles: ${(context.files || []).join(', ') || 'none'}\nAnalyze:`,
    ARC_SYSTEM.analysis
  );
  const analysis = parseJSON(analysisRaw) || { type: 'unknown', complexity: 'moderate', summary: request };
  emit('stage', { stage: 'analysis', status: 'done', data: analysis });

  emit('stage', { stage: 'plan', status: 'running' });
  const planRaw = await generate(
    `Task: ${request}\nAnalysis: ${JSON.stringify(analysis)}\nCreate plan:`,
    ARC_SYSTEM.plan
  );
  const plan = parseJSON(planRaw) || { steps: [] };
  emit('stage', { stage: 'plan', status: 'done', data: plan });

  emit('stage', { stage: 'code', status: 'running' });
  const codeRaw = await generate(
    `Plan: ${JSON.stringify(plan)}\n${context.existingCode ? `Existing:\n${context.existingCode}` : ''}\nWrite code:`,
    ARC_SYSTEM.code
  );
  let code = parseJSON(codeRaw) || { files: [], explanation: codeRaw };
  attachFrontierToArcResult({ plan, code, analysis, request });
  emit('stage', { stage: 'code', status: 'done', data: code });

  emit('stage', { stage: 'review', status: 'running' });
  let review, loops = 0;

  do {
    const reviewRaw = await generate(
      `Code: ${JSON.stringify(code)}\nPlan: ${JSON.stringify(plan)}\nReview:`,
      ARC_SYSTEM.review
    );
    review = parseJSON(reviewRaw) || { score: 0, passed: false, issues: [] };

    if (!review.passed && review.score < QUALITY_THRESHOLD && loops < MAX_REVIEW_LOOPS) {
      emit('stage', { stage: 'review', status: 'refining', data: { loop: loops + 1 } });
      const refinedRaw = await generate(
        `Code: ${JSON.stringify(code)}\nIssues: ${JSON.stringify(review.issues)}\nPlan: ${JSON.stringify(plan)}\nFix:`,
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
  emit('stage', { stage: 'review', status: 'done', data: review });
  emit('done', { success: true, code, review, plan, analysis, elapsed: Date.now() - startTime });

  return { success: true, code, review, plan, analysis, elapsed: Date.now() - startTime };
}

// ═══════════════════════════════════════════════════════════════
// JSON PARSER — FIX m4: added \x7F to regex
// ═══════════════════════════════════════════════════════════════

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
    .replace(/,\s*]/g, ']')
    .replace(/\n\s*/g, ' ')
    .replace(/\t/g, ' ');

  try { return JSON.parse(cleaned); } catch {}

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// IDEA-TO-PROJECT WORKFLOW
// ═══════════════════════════════════════════════════════════════

async function exploreIdea(idea) {
  const raw = await generate(
    `A person (maybe not a programmer) has this idea:\n"${idea}"\n\n1. Explain what this project IS in 2-3 simple sentences\n2. Ask 3-4 clarifying questions\n3. Suggest a project name\n4. Be encouraging\n\nOutput as JSON:\n{"explanation":"...","questions":["q1","q2","q3"],"suggestedName":"my-project"}`,
    'Be helpful and encouraging. Output ONLY JSON.'
  );
  return parseJSON(raw) || {
    explanation: `This sounds like a project to help with: ${idea}. Let's build it together.`,
    questions: ['What should it do exactly?', 'Who will use it?', 'What device will it run on?'],
    suggestedName: 'my-project'
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPRESS SERVER
// ═══════════════════════════════════════════════════════════════

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));
mountFrontierRoutes(app);

app.get('/api/health', (req, res) => {
  res.json({
    status: modelReady ? 'ready' : 'starting',
    backend,
    model: existsSync(MODEL_FILE) ? basename(MODEL_FILE) : null,
    modelExists: existsSync(MODEL_FILE),
    uptime: Math.floor((Date.now() - stats.startTime) / 1000),
    requests: stats.requests,
    errors: stats.errors,
    version: '1.0.1',
    frontier: require('./lib/frontier').getStatus()
  });
});

function getNetworkAddresses() {
  const interfaces = require('os').networkInterfaces();
  const addresses = [];
  for (const nets of Object.values(interfaces)) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(`http://${net.address}:${PORT}`);
      }
    }
  }
  return addresses;
}

app.get('/api/connect', (req, res) => {
  const addresses = getNetworkAddresses();
  const primary = addresses[0] || `http://localhost:${PORT}`;
  res.json({
    addresses,
    url: primary,
    qrCode: addresses.length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(primary)}`
      : null,
    instructions: 'Scan QR code with your phone camera to open Lighthouse'
  });
});

app.get('/api/model', (req, res) => {
  if (!existsSync(MODEL_FILE)) {
    return res.json({ exists: false, message: 'No model. Run: node setup.js' });
  }
  const s = statSync(MODEL_FILE);
  res.json({
    exists: true,
    name: basename(MODEL_FILE),
    sizeMB: (s.size / 1024 / 1024).toFixed(0),
    sizeGB: (s.size / 1024 / 1024 / 1024).toFixed(1)
  });
});

app.post('/api/arc', async (req, res) => {
  if (!modelReady) {
    return res.status(503).json({
      error: 'Model not ready',
      hint: backend === 'mock' ? 'Run: node setup.js to download a model' : 'Model is still loading'
    });
  }

  const { request, context = {} } = req.body;
  if (!request) return res.status(400).json({ error: 'Missing request' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  try {
    await runARCCycle(request, context, (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  } catch (err) {
    stats.errors++;
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.post('/api/generate', async (req, res) => {
  if (!modelReady) return res.status(503).json({ error: 'Model not ready' });
  const { prompt, system } = req.body;
  try {
    const text = await generate(prompt, system);
    res.json({ text });
  } catch (err) {
    stats.errors++;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/idea', async (req, res) => {
  if (!modelReady) return res.status(503).json({ error: 'Model not ready' });
  const { idea } = req.body;
  try {
    const result = await exploreIdea(idea);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    const projects = readdirSync(PROJECT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const d = JSON.parse(readFileSync(join(PROJECT_DIR, f), 'utf-8'));
        return { name: d.name, created: d.created, files: Object.keys(d.files || {}).length };
      });
    res.json(projects);
  } catch { res.json([]); }
});

app.post('/api/projects', (req, res) => {
  const { name, files } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  writeFileSync(join(PROJECT_DIR, `${safeName}.json`), JSON.stringify({
    name, created: new Date().toISOString(), files: files || {}
  }, null, 2));
  res.json({ saved: true, name: safeName });
});

app.get('/api/projects/:name', (req, res) => {
  const fp = join(PROJECT_DIR, `${req.params.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  if (!existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(readFileSync(fp, 'utf-8')));
});

app.post('/api/scan', async (req, res) => {
  const { dir = '.', query = '' } = req.body;
  const results = await scanFiles(dir, query);
  res.json({ count: results.length, results: results.slice(0, 30) });
});

const IMPACT_DIR = join(PROJECT_DIR, '_impact');

app.post('/api/impact', (req, res) => {
  const { type, description, navigator, community, language, region } = req.body;
  const validTypes = ['app_built', 'person_trained', 'community_served', 'kit_deployed'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use: ' + validTypes.join(', ') });
  }

  if (!existsSync(IMPACT_DIR)) mkdirSync(IMPACT_DIR, { recursive: true });

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    type,
    description: description || '',
    navigator: navigator || 'anonymous',
    community: community || 'unknown',
    language: language || 'en',
    region: region || 'global',
    version: '1.0.1'
  };

  const today = new Date().toISOString().split('T')[0];
  appendFileSync(join(IMPACT_DIR, `${today}.jsonl`), JSON.stringify(entry) + '\n');
  res.json({ recorded: true, id: entry.id });
});

app.get('/api/impact', (req, res) => {
  if (!existsSync(IMPACT_DIR)) {
    return res.json({ entries: [], totals: {}, total: 0, recentEntries: [] });
  }

  const allEntries = [];
  readdirSync(IMPACT_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .forEach(f => {
      readFileSync(join(IMPACT_DIR, f), 'utf-8')
        .split('\n')
        .filter(Boolean)
        .forEach(line => {
          try { allEntries.push(JSON.parse(line)); } catch {}
        });
    });

  const totals = {};
  const byDay = {};
  const byCommunity = {};
  allEntries.forEach(e => {
    totals[e.type] = (totals[e.type] || 0) + 1;
    const day = e.timestamp.split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
    byCommunity[e.community] = (byCommunity[e.community] || 0) + 1;
  });

  res.json({
    total: allEntries.length,
    totals,
    byDay,
    byCommunity,
    recentEntries: allEntries.slice(-50)
  });
});

async function scanFiles(dir, query) {
  const fs = require('fs').promises;
  const results = [];
  const codeExts = ['.js','.ts','.jsx','.tsx','.py','.html','.css','.json','.md','.rs','.go','.java','.rb','.php'];
  const exclude = new Set(['node_modules','.git','dist','build','.next','__pycache__','models','projects']);

  async function scan(d, depth = 0) {
    if (depth > 3) return;
    try {
      for (const entry of await fs.readdir(d, { withFileTypes: true })) {
        if (exclude.has(entry.name)) continue;
        const full = join(d, entry.name);
        if (entry.isDirectory()) await scan(full, depth + 1);
        else if (codeExts.includes(extname(entry.name))) {
          try {
            const content = (await fs.readFile(full, 'utf-8')).slice(0, 1000);
            if (!query || content.toLowerCase().includes(query.toLowerCase())) {
              results.push({ path: full, size: content.length, preview: content.slice(0, 200) });
            }
          } catch {}
        }
      }
    } catch {}
  }

  await scan(dir);
  return results;
}

// ═══════════════════════════════════════════════════════════════
// CLI MODE — FIX M2: timeout + progress
// ═══════════════════════════════════════════════════════════════

function startCLI() {
  const args = process.argv.slice(2);
  if (args.length === 0) return false;

  const runCLI = async () => {
    const API = `http://localhost:${PORT}/api`;

    let healthData;
    try {
      const hc = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
      healthData = await hc.json();
    } catch {
      console.log('❌ Server not running.');
      console.log('   Start it first: node core.js');
      console.log('   Then run your command again.\n');
      process.exit(1);
    }

    const input = args.join(' ');

    if (input.toLowerCase().startsWith('idea')) {
      const idea = input.replace(/^idea\s*/i, '');
      try {
        const res = await fetch(`${API}/idea`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: idea || 'a project' })
        });
        const data = await res.json();
        console.log(`\n💡 ${data.suggestedName || 'Project'}\n${data.explanation}\n`);
        console.log('Questions:');
        data.questions?.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
        console.log('\nAnswer these, then run: lighthouse "your answers here"\n');
      } catch (err) {
        console.log(`❌ ${err.message}`);
      }
      process.exit(0);
    }

    console.log(`\n🔍 Processing: ${input}`);

    if (healthData.backend === 'mock') {
      console.log('💡 Learning mode — responses will be templates, not custom code.');
      console.log('   Download a model: node setup.js\n');
    } else if (healthData.status === 'starting') {
      console.log('⏳ Model is still loading... this may take a minute on slow hardware.\n');
    }

    console.log('⏳ Working (timeout: 5 minutes)...\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLI_TIMEOUT);

    try {
      const res = await fetch(`${API}/arc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: input }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastStage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.stage) {
                if (data.stage.stage !== lastStage) {
                  lastStage = data.stage.stage;
                  const icon = data.stage.status === 'running' ? '⏳' :
                               data.stage.status === 'done' ? '✅' : '🔄';
                  console.log(`${icon} ${data.stage.stage}: ${data.stage.status}`);
                }
              }

              if (data.plan?.steps) {
                console.log('\n📋 Plan:');
                data.plan.steps.forEach(s => console.log(`  ${s.step}. ${s.description}`));
              }

              if (data.code?.files) {
                console.log('\n📁 Generated Files:');
                for (const file of data.code.files) {
                  console.log(`\n── ${file.path} ──`);
                  console.log(file.content.slice(0, 1000));
                  if (file.content.length > 1000) console.log('...(truncated)');
                }
              }

              if (data.review?.score) {
                const pct = (data.review.score * 100).toFixed(0);
                console.log(`\n🔍 Review: ${pct}% ${data.review.passed ? '✅' : '⚠️'} (${data.review.loops || 0} refinements)`);
              }

              if (data.elapsed) {
                console.log(`⏱️  ${(data.elapsed / 1000).toFixed(1)}s\n`);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.log('\n❌ Request timed out (5 minutes).');
        console.log('   The model may still be loading on slow hardware.');
        console.log('   Check another terminal for "Model loaded" message.');
        console.log('   Or try with a smaller request.\n');
      } else if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
        console.log('\n❌ Lost connection to server.');
        console.log('   The server may have crashed. Restart: node core.js\n');
      } else {
        console.log(`\n❌ ${err.message}\n`);
      }
      process.exit(1);
    }
  };

  runCLI();
  return true;
}

// ═══════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════

async function start() {
  if (startCLI()) return;

  console.log(`
  ⚡  LIGHTHOUSE v1.0.1
  ═══════════════════════════════════════
  Free offline AI coding agent
  No subscription. No cloud. Works everywhere.
  ═══════════════════════════════════════
  `);

  await detectBackend();

  app.listen(PORT, () => {
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📁 Projects: ${PROJECT_DIR}`);
    console.log(`📦 Model: ${existsSync(MODEL_FILE) ? basename(MODEL_FILE) : 'not downloaded'}`);
    console.log(`🖥️  Open http://localhost:${PORT} in any browser`);

    const addresses = getNetworkAddresses();
    if (addresses.length > 0) {
      console.log(`📱 Phone:  ${addresses[0]}/connect.html  (QR: /api/connect)`);
    }

    if (backend === 'mock') {
      console.log(`\n💡 LEARNING MODE — download a model for full AI coding:`);
      console.log(`   node setup.js\n`);
    }
    console.log('');
  });

  const shutdown = () => {
    console.log('\n🛑 Shutting down...');
    if (modelProcess) modelProcess.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
