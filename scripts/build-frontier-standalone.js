#!/usr/bin/env node
/*
  FRONTIER STANDALONE BUILDER — Run the complete overhaul pipeline
  Replaces: release.js + npm + Capacitor + Express for Frontier-native shipping
*/

const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { ROOT, GENERATED_DIR } = require('./lib/frontier-utils');
const { FrontierCodeGenerator } = require('./frontier-codegen');
const { generateUIBindings } = require('./frontier-ui-bindings');
const { generateAIBindings } = require('./frontier-ai-bindings');
const { generateServerSource } = require('./frontier-http-server');
const { buildNativeServer } = require('./build-frontier-server');
const { crossCompileAll } = require('./frontier-cross-compile');
const { buildSingleBinary } = require('./frontier-single-binary');
const { writeFileSync } = require('fs');

async function buildFrontierStandalone() {
  console.log('\n⚡ LIGHTHOUSE FRONTIER TOTAL OVERHAUL\n');
  console.log('Eliminating: Node.js • Express • Capacitor • WebView • npm install\n');

  mkdirSync(GENERATED_DIR, { recursive: true });
  mkdirSync(join(ROOT, 'releases'), { recursive: true });

  console.log('── Step 1: Generate binding stubs ──');
  writeFileSync(join(GENERATED_DIR, 'frontier_ui_bindings.fr'), generateUIBindings());
  writeFileSync(join(GENERATED_DIR, 'frontier_ai_bindings.fr'), generateAIBindings());
  writeFileSync(join(GENERATED_DIR, 'lighthouse_server.fr'), generateServerSource());
  console.log('   ✅ UI + AI + HTTP bindings');

  console.log('\n── Step 2: Sample app codegen ──');
  const gen = new FrontierCodeGenerator();
  const sample = gen.generateFromARC({
    analysis: { summary: 'Village water pump tracker' },
    plan: {
      steps: [
        { step: 1, description: 'Create database to store pump records' },
        { step: 2, description: 'Create main screen with add button and pump list' }
      ]
    }
  });
  writeFileSync(join(GENERATED_DIR, sample.files[0].path), sample.source);
  console.log(`   ✅ ${sample.files[0].path}`);

  console.log('\n── Step 3: Native server binaries ──');
  await buildNativeServer();

  console.log('\n── Step 4: Cross-compile all platforms ──');
  await crossCompileAll();

  console.log('\n── Step 5: Single binary ──');
  await buildSingleBinary();

  console.log('\n── Step 6: Mobile native (if compiler available) ──');
  const frFile = join(GENERATED_DIR, sample.files[0].path);
  if (existsSync(frFile)) {
    try {
      require('./build-frontier-mobile');
      const { buildAndroidAPK } = require('./build-frontier-mobile');
      await buildAndroidAPK(frFile, sample.appName);
    } catch (e) {
      console.log(`   ⚠️  Mobile: ${e.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('FRONTIER OVERHAUL COMPLETE');
  console.log('═'.repeat(60));
  console.log(`
releases/
├── native-all/       ← cross-compiled server binaries
├── server-native/    ← per-platform server builds
├── single-binary/    ← one-file deployment
└── native/           ← native APK shells

Set LIGHTHOUSE_OUTPUT=frontier for ARC to emit .fr only.
Set LIGHTHOUSE_OUTPUT=hybrid for .fr + JS (default).
`);
}

if (require.main === module) {
  buildFrontierStandalone().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { buildFrontierStandalone };
