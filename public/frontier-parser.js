/*
  Frontier-Syntax in-browser validation for Lighthouse code panel.
  Loads wasm_parser.wasm when available (Cycle 6); falls back to Cycle-1 lexer.
*/
(function (global) {
  let wasmInstance = null;
  let tokenTable = null;
  let ready = false;

  async function loadTokenTable() {
    if (tokenTable) return tokenTable;
    const res = await fetch('/syntax/token_regex_table.json');
    if (!res.ok) throw new Error('Frontier token table not found');
    tokenTable = await res.json();
    return tokenTable;
  }

  async function loadWasm() {
    try {
      const res = await fetch('/syntax/wasm_parser.wasm');
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {
        env: {
          abort: () => { throw new Error('Frontier WASM abort'); }
        }
      });
      return instance;
    } catch {
      return null;
    }
  }

  function detectLanguage(code, language, filename) {
    if (language && language !== 'auto') return language;
    const ext = (filename || '').split('.').pop()?.toLowerCase();
    if (ext === 'fr' || ext === 'frontier') return 'frontier';
    if (ext === 'py') return 'python';
    if (['js', 'mjs', 'cjs', 'ts'].includes(ext)) return 'javascript';
    const head = code.trimStart().slice(0, 200);
    if (/^(fn|let)\s/.test(head)) return 'frontier';
    if (/^(def |import )/m.test(head)) return 'python';
    return 'javascript';
  }

  function lexFrontierSource(code) {
    if (!tokenTable?.tokens) {
      return { valid: false, mode: 'frontier-lexer', language: 'frontier', errors: [{ message: 'Token table not loaded' }] };
    }

    const rules = Object.entries(tokenTable.tokens).map(([name, spec]) => ({
      name,
      emits: spec.emits_token !== false,
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
        errors.push({ message: `Unexpected '${code[pos]}'`, line, column: col });
        pos += 1;
        col += 1;
        continue;
      }

      if (best.emits) tokens.push({ type: best.name, text: best.text, line, column: col });

      for (const ch of best.text) {
        if (ch === '\n') { line += 1; col = 1; } else { col += 1; }
      }
      pos += bestLen;
    }

    return {
      valid: errors.length === 0,
      mode: wasmInstance ? 'frontier-wasm+lexer' : 'frontier-lexer',
      language: 'frontier',
      errors,
      tokens,
      tokenCount: tokens.length
    };
  }

  function validateJavaScript(code) {
    try {
      new Function(code);
      return { valid: true, mode: 'js-syntax-check', language: 'javascript', errors: [] };
    } catch (e) {
      return { valid: false, mode: 'js-syntax-check', language: 'javascript', errors: [{ message: e.message }] };
    }
  }

  function validatePython(code) {
    const opens = (code.match(/[\(\[\{]/g) || []).length;
    const closes = (code.match(/[\)\]\}]/g) || []).length;
    const errors = [];
    if (opens !== closes) {
      errors.push({ message: `Unbalanced brackets (${opens}/${closes})` });
    }
    return {
      valid: errors.length === 0,
      mode: 'python-heuristic',
      language: 'python',
      errors,
      warnings: ['Heuristic check — run Python for full validation']
    };
  }

  function validateWithWasm(code) {
    const exp = wasmInstance.exports;
    if (typeof exp.parse === 'function') {
      const ptr = typeof exp.alloc === 'function' ? exp.alloc(code.length) : 0;
      if (ptr && typeof exp.memory !== 'undefined') {
        const mem = new Uint8Array(exp.memory.buffer);
        const enc = new TextEncoder();
        const bytes = enc.encode(code);
        mem.set(bytes, ptr);
        const resultPtr = exp.parse(ptr, bytes.length);
        if (resultPtr && typeof exp.read_string === 'function') {
          const json = exp.read_string(resultPtr);
          return JSON.parse(json);
        }
      }
      const raw = exp.parse(code);
      if (typeof raw === 'string') return JSON.parse(raw);
    }
    return null;
  }

  async function initFrontierParser() {
    if (ready) return true;
    try {
      await loadTokenTable();
      wasmInstance = await loadWasm();
      ready = true;
      console.log(wasmInstance
        ? '✅ Frontier WASM parser loaded — real-time validation active'
        : '✅ Frontier lexer loaded (WASM pending Cycle 6) — token validation active');
      return true;
    } catch (e) {
      console.warn('Frontier parser init:', e.message);
      ready = true;
      return false;
    }
  }

  async function validateFrontierCode(code, options = {}) {
    if (!ready) await initFrontierParser();
    const language = detectLanguage(code, options.language, options.filename);

    if (language === 'frontier') {
      if (wasmInstance) {
        try {
          const wasmResult = validateWithWasm(code);
          if (wasmResult) return wasmResult;
        } catch {}
      }
      return lexFrontierSource(code);
    }
    if (language === 'python') return validatePython(code);
    if (language === 'javascript') return validateJavaScript(code);
    return { valid: true, mode: 'skipped', language, errors: [] };
  }

  global.initFrontierParser = initFrontierParser;
  global.validateFrontierCode = validateFrontierCode;
  global.frontierParserReady = () => ready;
})(window);
