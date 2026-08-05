#!/usr/bin/env node
/*
  FRONTIER SINGLE BINARY — One executable, zero dependencies
  Replaces: multi-file deployment, npm install, setup.js
*/

const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync, statSync } = require('fs');
const { join } = require('path');
const { ROOT, GENERATED_DIR, compileFrontier, findFrontierCompiler } = require('./lib/frontier-utils');

const OUTPUT_DIR = join(ROOT, 'releases', 'single-binary');

function generateSingleBinarySource() {
  return `// Lighthouse — Single Binary Edition
// Generated: ${new Date().toISOString()}

module lighthouse;

const WEB_UI: &str = r#"<!DOCTYPE html><html><head><meta charset=UTF-8><title>Lighthouse</title>
<style>body{font-family:system-ui;background:#0a0a1a;color:#e0e0f0;margin:0;padding:16px}</style></head>
<body><h1>⚡ Lighthouse</h1><p>Frontier single binary — no Node.js</p></body></html>"#;

fn router(path: &str, _body: &str) -> (i32, &str, &str) {
  if path == "/" || path == "/index.html" {
    return (200, "text/html", WEB_UI);
  }
  if path == "/api/health" {
    return (200, "application/json", "{\\"status\\":\\"ready\\",\\"runtime\\":\\"frontier-single-binary\\"}");
  }
  (404, "text/plain", "Not found")
}

fn main() -> void {
  print("⚡ Lighthouse Single Binary");
  print("   Open http://localhost:8899");
  let listener = tcp_bind("0.0.0.0:8899");
  loop {
    let conn = listener.accept();
    let request = conn.read_http();
    let (status, content_type, body) = router(request.path, request.body);
    conn.write_http(status, content_type, body);
  }
}
`;
}

async function buildSingleBinary(target = process.env.FRONTIER_TARGET || 'x86_64-unknown-linux-gnu') {
  console.log('═'.repeat(60));
  console.log('FRONTIER SINGLE BINARY BUILDER');
  console.log('═'.repeat(60));

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(GENERATED_DIR, { recursive: true });

  const sourcePath = join(GENERATED_DIR, 'lighthouse_single.fr');
  writeFileSync(sourcePath, generateSingleBinarySource());

  const outputName = join(OUTPUT_DIR, 'lighthouse');
  const compiler = findFrontierCompiler();

  if (!compiler) {
    console.log(`⚠️  Frontier compiler not found — source at ${sourcePath}`);
    return { ok: false, source: sourcePath };
  }

  console.log(`Compiling for ${target}...`);
  const result = compileFrontier(sourcePath, outputName, { target });
  if (!result.ok) {
    console.log(`❌ ${result.detail || result.error}`);
    return result;
  }

  try { execSync(`strip "${outputName}" 2>/dev/null || true`); } catch {}
  try { execSync(`upx --best "${outputName}" 2>/dev/null || true`); } catch {}

  const sizeMB = (statSync(outputName).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ ${outputName} (${sizeMB} MB)`);
  return { ok: true, path: outputName, sizeMB };
}

if (require.main === module) {
  buildSingleBinary().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { buildSingleBinary, generateSingleBinarySource };
