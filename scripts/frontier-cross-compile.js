#!/usr/bin/env node
/*
  FRONTIER CROSS-COMPILER — All platform native binaries
  Replaces platform-specific installers and per-OS Docker builds
*/

const { execSync } = require('child_process');
const { existsSync, mkdirSync, statSync } = require('fs');
const { join } = require('path');
const { buildNativeServer } = require('./build-frontier-server');
const {
  ROOT, GENERATED_DIR, compileFrontier, findFrontierCompiler
} = require('./lib/frontier-utils');

const OUTPUT_DIR = join(ROOT, 'releases', 'native-all');

const TARGETS = [
  { target: 'x86_64-unknown-linux-gnu', name: 'lighthouse-linux-x64', ext: '' },
  { target: 'aarch64-unknown-linux-gnu', name: 'lighthouse-linux-arm64', ext: '' },
  { target: 'armv7-unknown-linux-gnueabihf', name: 'lighthouse-linux-armv7l', ext: '' },
  { target: 'x86_64-apple-darwin', name: 'lighthouse-macos-x64', ext: '' },
  { target: 'aarch64-apple-darwin', name: 'lighthouse-macos-arm64', ext: '' },
  { target: 'x86_64-pc-windows-gnu', name: 'lighthouse-windows-x64', ext: '.exe' },
  { target: 'aarch64-linux-android', name: 'lighthouse-android-arm64', ext: '.so' },
  { target: 'armv7-linux-androideabi', name: 'lighthouse-android-armv7', ext: '.so' },
  { target: 'aarch64-apple-ios', name: 'lighthouse-ios-arm64', ext: '.a' },
  { target: 'arm-unknown-linux-gnueabihf', name: 'lighthouse-raspberry-pi-zero', ext: '' },
  { target: 'riscv64gc-unknown-linux-gnu', name: 'lighthouse-riscv64', ext: '' }
];

async function crossCompileAll() {
  console.log('═'.repeat(60));
  console.log('FRONTIER CROSS-COMPILER');
  console.log('═'.repeat(60));
  console.log(`Targets: ${TARGETS.length}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const serverFR = join(GENERATED_DIR, 'lighthouse_server.fr');
  if (!existsSync(serverFR)) {
    await buildNativeServer();
  }
  if (!existsSync(serverFR)) {
    console.log('❌ No server source — run build-frontier-server first');
    return { ok: false };
  }

  if (!findFrontierCompiler()) {
    console.log('⚠️  Frontier compiler not installed — cannot cross-compile binaries');
    return { ok: false };
  }

  let success = 0;
  let failed = 0;

  for (const { target, name, ext } of TARGETS) {
    const outputPath = join(OUTPUT_DIR, name + ext);
    process.stdout.write(`  ${name}... `);
    const result = compileFrontier(serverFR, outputPath, { target });
    if (result.ok) {
      try { execSync(`strip "${outputPath}" 2>/dev/null || true`); } catch {}
      const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`✅ (${sizeMB}MB)`);
      success++;
    } else {
      console.log(`⚠️  skipped`);
      failed++;
    }
  }

  try {
    execSync(`cd "${OUTPUT_DIR}" && sha256sum * > SHA256SUMS 2>/dev/null || true`);
  } catch {}

  console.log(`\n✅ ${success} built  ⚠️ ${failed} skipped`);
  console.log(`Output: ${OUTPUT_DIR}`);
  return { ok: success > 0, success, failed };
}

if (require.main === module) {
  crossCompileAll().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { crossCompileAll, TARGETS };
