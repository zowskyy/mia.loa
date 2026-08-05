/*
  Lighthouse ↔ Frontier-Syntax bridge (server)

  Validates generated code and compiles Frontier source to native binaries
  when the Frontier compiler is available (FRONTIER_COMPILER or FRONTIER_HOME).
*/

const { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync } = require('fs');
const { join, basename, extname } = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SYNTAX_DIR = join(__dirname, '..', 'public', 'syntax');
const TOKEN_TABLE_PATH = join(SYNTAX_DIR, 'token_regex_table.json');
const WASM_PATH = join(SYNTAX_DIR, 'wasm_parser.wasm');

let tokenTableCache = null;

function getTokenTable() {
  if (!tokenTableCache && existsSync(TOKEN_TABLE_PATH)) {
    tokenTableCache = JSON.parse(readFileSync(TOKEN_TABLE_PATH, 'utf-8'));
  }
  return tokenTableCache;
}

function findCompiler() {
  const candidates = [
    process.env.FRONTIER_COMPILER,
    process.env.FRONTIER_HOME && join(process.env.FRONTIER_HOME, 'target', 'release', 'frontier'),
    join(__dirname, '..', 'vendor', 'frontier-syntax', 'target', 'release', 'frontier'),
    'frontier'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        if (existsSync(candidate)) return candidate;
      } else {
        execSync(`command -v ${candidate}`, { stdio: 'ignore' });
        return candidate;
      }
    } catch {}
  }
  return null;
}

function detectLanguage(code, language, filename = '') {
  if (language && language !== 'auto') return language;
  const ext = extname(filename).toLowerCase().replace('.', '');
  if (ext === 'fr' || ext === 'frontier') return 'frontier';
  if (ext === 'py') return 'python';
  if (['js', 'mjs', 'cjs', 'ts'].includes(ext)) return 'javascript';
  const head = code.trimStart().slice(0, 200);
  if (/^(fn|let)\s/.test(head) || head.includes('fn main')) return 'frontier';
  if (/^(def |import |from )/m.test(head)) return 'python';
  return 'javascript';
}

function lexFrontierSource(code) {
  const table = getTokenTable();
  if (!table?.tokens) {
    return { valid: false, mode: 'frontier-lexer', language: 'frontier', errors: [{ message: 'Frontier token table not found' }], tokens: [] };
  }

  const rules = Object.entries(table.tokens).map(([name, spec]) => ({
    name,
    emits: spec.emits_token !== false,
    category: spec.category,
    regex: new RegExp(spec.pattern)
  }));

  const errors = [];
  const tokens = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  while (pos < code.length) {
    const rest = code.slice(pos);
    let best = null;
    let bestLen = 0;

    for (const rule of rules) {
      const match = rest.match(rule.regex);
      if (match && match[0].length > bestLen) {
        bestLen = match[0].length;
        best = { ...rule, text: match[0] };
      }
    }

    if (!best || bestLen === 0) {
      errors.push({ message: `Unexpected character '${code[pos]}'`, line, column: col });
      pos += 1;
      col += 1;
      continue;
    }

    if (best.emits) {
      tokens.push({ type: best.name, text: best.text, line, column: col, category: best.category });
    }

    for (const ch of best.text) {
      if (ch === '\n') {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
    }
    pos += bestLen;
  }

  return {
    valid: errors.length === 0,
    mode: existsSync(WASM_PATH) ? 'frontier-lexer+wasm-pending' : 'frontier-lexer',
    language: 'frontier',
    errors,
    tokens,
    tokenCount: tokens.length
  };
}

function validateJavaScript(code) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    return { valid: true, mode: 'js-syntax-check', language: 'javascript', errors: [], warnings: [] };
  } catch (e) {
    return {
      valid: false,
      mode: 'js-syntax-check',
      language: 'javascript',
      errors: [{ message: e.message }]
    };
  }
}

function validatePython(code) {
  const errors = [];
  const lines = code.split('\n');
  let indentStack = [0];

  lines.forEach((line, idx) => {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = line.length - line.trimStart().length;
    if (trimmed.endsWith(':')) {
      indentStack.push(indent + 1);
    } else if (indent < indentStack[indentStack.length - 1]) {
      while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
      }
      if (indent !== indentStack[indentStack.length - 1] && indentStack.length > 1) {
        errors.push({ message: 'Inconsistent indentation', line: idx + 1, column: 1 });
      }
    }
  });

  const opens = (code.match(/[\(\[\{]/g) || []).length;
  const closes = (code.match(/[\)\]\}]/g) || []).length;
  if (opens !== closes) {
    errors.push({ message: `Unbalanced brackets (${opens} open, ${closes} close)` });
  }

  return {
    valid: errors.length === 0,
    mode: 'python-heuristic',
    language: 'python',
    errors,
    warnings: errors.length ? [] : ['Heuristic check only — run Python for full validation']
  };
}

function validateCode(code, options = {}) {
  const language = detectLanguage(code, options.language, options.filename || '');
  if (language === 'frontier') return lexFrontierSource(code);
  if (language === 'python') return validatePython(code);
  if (language === 'javascript') return validateJavaScript(code);
  return { valid: true, mode: 'skipped', language, errors: [] };
}

function rmDir(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) rmDir(p);
    else unlinkSync(p);
  }
  try { require('fs').rmdirSync(dir); } catch {}
}

function compileToNative(code, options = {}) {
  const compiler = findCompiler();
  const language = detectLanguage(code, options.language, options.filename || '');
  const filename = options.filename || 'main.fr';

  if (!compiler) {
    return {
      ok: false,
      error: 'Frontier compiler not installed on this server',
      hint: 'Build frontier-syntax (cargo build --release) and set FRONTIER_COMPILER or FRONTIER_HOME',
      language
    };
  }

  if (language !== 'frontier') {
    return {
      ok: false,
      error: `Native compile requires Frontier syntax (.fr), detected: ${language}`,
      hint: 'Lighthouse generates JS/Python today. Ask Lighthouse to output Frontier syntax, or use JS/Python download.',
      language
    };
  }

  const tmp = join(os.tmpdir(), `lighthouse-fr-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const base = basename(filename).replace(/\.[^.]+$/, '') || 'main';
  const src = join(tmp, `${base}.fr`);
  const out = join(tmp, base);
  writeFileSync(src, code, 'utf-8');

  const attempts = [
  [compiler, 'compile', src, '-o', out],
  [compiler, 'build', src, '-o', out],
  [compiler, src, '-o', out]
  ];

  let lastError = 'Unknown compile error';
  for (const parts of attempts) {
    try {
      execSync(parts.map(p => `"${p}"`).join(' '), { timeout: 120000, stdio: 'pipe' });
      if (existsSync(out)) {
        const binary = readFileSync(out);
        rmDir(tmp);
        return {
          ok: true,
          size: binary.length,
          binary: binary.toString('base64'),
          filename: basename(out),
          compiler
        };
      }
    } catch (e) {
      lastError = e.stderr?.toString() || e.message || lastError;
    }
  }

  rmDir(tmp);
  return { ok: false, error: 'Frontier compile failed', detail: lastError, language };
}

function getStatus() {
  return {
    wasmParser: existsSync(WASM_PATH),
    tokenTable: existsSync(TOKEN_TABLE_PATH),
    compiler: findCompiler(),
    frontierRepo: 'https://github.com/zowskyy/frontier-syntax',
    protocol: 'A+ Hard Gate v1.0'
  };
}

function mountFrontierRoutes(app) {
  app.get('/api/frontier/status', (req, res) => {
    res.json(getStatus());
  });

  app.post('/api/frontier/validate', (req, res) => {
    const { code, language, filename } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code' });
    }
    res.json(validateCode(code, { language, filename }));
  });

  app.post('/api/frontier/compile', (req, res) => {
    const { code, language, filename } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code' });
    }
    res.json(compileToNative(code, { language, filename }));
  });
}

module.exports = {
  getStatus,
  validateCode,
  compileToNative,
  lexFrontierSource,
  detectLanguage,
  mountFrontierRoutes
};
