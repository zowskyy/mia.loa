#!/usr/bin/env node
/*
  FRONTIER SERVER BUILDER — Native Lighthouse server binary
  Replaces: Node.js runtime, Express, npm install
*/

const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { generateServerSource } = require('./frontier-http-server');
const {
  ROOT, GENERATED_DIR, compileFrontier, findFrontierCompiler
} = require('./lib/frontier-utils');

const OUTPUT_DIR = join(ROOT, 'releases', 'server-native');

async function buildNativeServer() {
  console.log('═'.repeat(60));
  console.log('FRONTIER NATIVE SERVER BUILDER');
  console.log('═'.repeat(60));
  console.log('Replacing: Node.js + Express + npm\n');

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(GENERATED_DIR, { recursive: true });

  const serverFR = join(GENERATED_DIR, 'lighthouse_server.fr');
  console.log('1. Generating Frontier HTTP server source...');
  writeFileSync(serverFR, generateServerSource());

  const compiler = findFrontierCompiler();
  if (!compiler) {
    console.log(`   ⚠️  Frontier compiler not found — source written to ${serverFR}`);
    console.log('   Build frontier-syntax, then re-run this script.');
    return { ok: false, source: serverFR };
  }

  const targets = [
    { target: 'x86_64-unknown-linux-gnu', name: 'lighthouse-linux-x64', ext: '' },
    { target: 'aarch64-unknown-linux-gnu', name: 'lighthouse-linux-arm64', ext: '' },
    { target: 'armv7-unknown-linux-gnueabihf', name: 'lighthouse-linux-armv7l', ext: '' },
    { target: 'x86_64-apple-darwin', name: 'lighthouse-macos-x64', ext: '' },
    { target: 'aarch64-apple-darwin', name: 'lighthouse-macos-arm64', ext: '' },
    { target: 'x86_64-pc-windows-gnu', name: 'lighthouse-windows-x64', ext: '.exe' }
  ];

  let built = 0;
  for (const { target, name, ext } of targets) {
    console.log(`   Compiling ${name} (${target})...`);
    const out = join(OUTPUT_DIR, name + ext);
    const result = compileFrontier(serverFR, out, { target });
    if (result.ok) {
      try { execSync(`strip "${out}" 2>/dev/null || true`); } catch {}
      console.log(`   ✅ ${name}${ext}`);
      built++;
    } else {
      console.log(`   ⚠️  ${target}: ${result.detail || result.error}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ ${built}/${targets.length} server binaries`);
  console.log(`Output: ${OUTPUT_DIR}`);
  return { ok: built > 0, built, outputDir: OUTPUT_DIR };
}

if (require.main === module) {
  buildNativeServer().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { buildNativeServer };
