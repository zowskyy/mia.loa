/*
  BrowserCompiler — Frontier WASM compiler in the browser.
  Replaces local build scripts when wasm_compiler.wasm is available.
  Falls back: parser WASM → JS capsule → server compile API.
*/

const COMPILE_TARGETS = [
  { id: 'linux-x64', label: 'Linux Binary', ext: '', os: 'linux', arch: 'x64' },
  { id: 'linux-arm64', label: 'Linux ARM64 (Raspberry Pi 4/5)', ext: '', os: 'linux', arch: 'arm64' },
  { id: 'linux-armv7l', label: 'Linux ARMv7 (Raspberry Pi 2/3)', ext: '', os: 'linux', arch: 'armv7' },
  { id: 'windows-x64', label: 'Windows .exe', ext: '.exe', os: 'windows', arch: 'x64' },
  { id: 'macos-x64', label: 'macOS Intel', ext: '', os: 'macos', arch: 'x64' },
  { id: 'macos-arm64', label: 'macOS Apple Silicon', ext: '', os: 'macos', arch: 'arm64' },
  { id: 'android-arm64', label: 'Android ARM64', ext: '.apk', os: 'android', arch: 'arm64' },
  { id: 'android-armv7', label: 'Android ARMv7', ext: '.apk', os: 'android', arch: 'armv7' },
  { id: 'ios-arm64', label: 'iOS ARM64', ext: '.ipa', os: 'ios', arch: 'arm64' },
  { id: 'rpi-zero', label: 'Raspberry Pi Zero', ext: '', os: 'linux', arch: 'armv6' },
  { id: 'riscv64', label: 'RISC-V 64', ext: '', os: 'linux', arch: 'riscv64' }
];

const BrowserCompiler = {
  wasmModule: null,
  wasmExports: null,
  mode: 'none', // 'compiler' | 'parser' | 'none'
  ready: false,
  initPromise: null,

  async init() {
    if (this.ready) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const wasmPaths = [
        '/syntax/wasm_compiler.wasm',
        '/syntax/frontier_compiler.wasm',
        '/syntax/wasm_parser.wasm'
      ];

      for (const path of wasmPaths) {
        try {
          const response = await fetch(path);
          if (!response.ok) continue;
          const bytes = await response.arrayBuffer();
          const result = await WebAssembly.instantiate(bytes, {
            env: {
              abort: () => { throw new Error('Frontier WASM abort'); }
            }
          });
          this.wasmExports = result.instance.exports;
          this.wasmModule = result.instance;
          this.mode = path.includes('parser') ? 'parser' : 'compiler';
          this.ready = true;
          console.log(`✅ Frontier WASM loaded (${this.mode}): ${path}`);
          return true;
        } catch (e) {
          console.warn(`WASM load failed for ${path}:`, e.message);
        }
      }

      console.log('💡 Frontier WASM not found — server-side compile fallback available');
      this.ready = true;
      this.mode = 'none';
      return false;
    })();

    return this.initPromise;
  },

  isAvailable() {
    return this.mode === 'compiler' || this.mode === 'parser';
  },

  detectUserTarget() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    if (/android/.test(ua)) return 'android-arm64';
    if (/iphone|ipad/.test(ua)) return 'ios-arm64';
    if (/win/.test(platform) || /windows/.test(ua)) return 'windows-x64';
    if (/mac/.test(platform)) return 'macos-arm64';
    if (/arm/.test(platform) || /aarch64/.test(ua)) return 'linux-arm64';
    return 'linux-x64';
  },

  async getTargets() {
    await this.init();

    if (this.wasmExports?.get_targets) {
      try {
        const raw = this.callWasm('get_targets', '', '');
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    const preferred = this.detectUserTarget();
    return COMPILE_TARGETS.map(t => ({
      ...t,
      recommended: t.id === preferred
    }));
  },

  async compile(source, target = 'linux-x64') {
    await this.init();

    if (this.wasmExports?.compile) {
      try {
        const result = this.callWasm('compile', source, target);
        const binary = this.decodeBinary(result);
        return {
          success: true,
          binary,
          target,
          size: binary.length,
          compiledIn: 'browser-wasm',
          zeroDependencies: true
        };
      } catch (e) {
        console.warn('WASM compile failed:', e.message);
      }
    }

    if (this.mode === 'parser' && typeof validateFrontierCode === 'function') {
      const validation = await validateFrontierCode(source, { language: 'frontier' });
      if (!validation.valid) {
        return { success: false, error: 'Frontier syntax validation failed', details: validation.errors };
      }
      const binary = this.buildCapsule(source, target, 'parser-validated');
      return {
        success: true,
        binary,
        target,
        size: binary.length,
        compiledIn: 'browser-parser',
        zeroDependencies: true,
        note: 'Validated capsule — full native codegen when wasm_compiler.wasm ships'
      };
    }

    try {
      const res = await fetch('/api/frontier/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, code: source, target, language: 'frontier' })
      });
      const data = await res.json();
      if (data.ok && data.binary) {
        const binary = Uint8Array.from(atob(data.binary), c => c.charCodeAt(0));
        return {
          success: true,
          binary,
          target,
          size: binary.length,
          compiledIn: 'server',
          zeroDependencies: false,
          filename: data.filename
        };
      }
      return { success: false, error: data.error || 'Server compile failed', hint: data.hint };
    } catch (e) {
      const binary = this.buildCapsule(source, target, 'offline-capsule');
      return {
        success: true,
        binary,
        target,
        size: binary.length,
        compiledIn: 'browser-offline',
        zeroDependencies: true,
        note: 'Offline capsule — sync when Frontier compiler WASM is available'
      };
    }
  },

  buildCapsule(source, target, mode) {
    const meta = JSON.stringify({
      magic: 'LHN1',
      target,
      mode,
      compiledAt: new Date().toISOString(),
      version: '1.0.0'
    });
    const enc = new TextEncoder();
    const metaBytes = enc.encode(meta);
    const srcBytes = enc.encode(source);
    const out = new Uint8Array(4 + metaBytes.length + 4 + srcBytes.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, metaBytes.length, true);
    out.set(metaBytes, 4);
    view.setUint32(4 + metaBytes.length, srcBytes.length, true);
    out.set(srcBytes, 8 + metaBytes.length);
    return out;
  },

  decodeBinary(result) {
    if (result instanceof Uint8Array) return result;
    if (result?.binary instanceof Uint8Array) return result.binary;
    if (typeof result?.binary === 'string') {
      return Uint8Array.from(atob(result.binary), c => c.charCodeAt(0));
    }
    if (Array.isArray(result?.binary)) return new Uint8Array(result.binary);
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        return this.decodeBinary(parsed);
      } catch {
        return new TextEncoder().encode(result);
      }
    }
    throw new Error('Unexpected WASM compile result format');
  },

  callWasm(funcName, source, target) {
    const fn = this.wasmExports?.[funcName];
    if (typeof fn !== 'function') throw new Error(`WASM function ${funcName} not found`);

    if (this.wasmExports.alloc && this.wasmExports.memory) {
      const encoder = new TextEncoder();
      const payload = JSON.stringify({ source, target });
      const utf8 = encoder.encode(payload);
      const ptr = this.wasmExports.alloc(utf8.length + 1);
      const mem = new Uint8Array(this.wasmExports.memory.buffer);
      mem.set(utf8, ptr);
      mem[ptr + utf8.length] = 0;

      const resultPtr = fn(ptr, utf8.length);
      let resultString = '';

      if (this.wasmExports.get_result_length && this.wasmExports.read_string) {
        const resultLen = this.wasmExports.get_result_length(resultPtr);
        resultString = this.wasmExports.read_string(resultPtr, resultLen);
      } else if (typeof resultPtr === 'number') {
        const len = this.wasmExports.get_result_length?.(resultPtr) || 0;
        if (len > 0) {
          const bytes = new Uint8Array(this.wasmExports.memory.buffer, resultPtr, len);
          resultString = new TextDecoder().decode(bytes);
        }
      } else if (typeof resultPtr === 'string') {
        resultString = resultPtr;
      }

      if (this.wasmExports.free) {
        this.wasmExports.free(ptr);
        if (resultPtr) this.wasmExports.free(resultPtr);
      }

      if (resultString) {
        try { return JSON.parse(resultString); } catch { return resultString; }
      }
    }

    return fn(source, target);
  },

  downloadBinary(binary, filename) {
    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

window.BrowserCompiler = BrowserCompiler;
