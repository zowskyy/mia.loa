#!/usr/bin/env node
/*
  FRONTIER MOBILE BUILDER — Native APK/iOS from .fr source
  Replaces: Capacitor, WebView, Android Studio for end users
*/

const { execSync } = require('child_process');
const {
  existsSync, mkdirSync, writeFileSync, copyFileSync, rmSync
} = require('fs');
const { join } = require('path');
const {
  ROOT, FRONTIER_HOME, findFrontierCompiler, compileFrontier, slugify
} = require('./lib/frontier-utils');
const { buildNativeApk, packageIosProject } = require('../lib/frontier-mobile');

const OUTPUT_DIR = join(ROOT, 'releases', 'native');

async function buildAndroidAPK(frontierFile, appName) {
  console.log(`\n📱 Building Android APK: ${appName}`);

  const buildDir = join(ROOT, 'build', 'android', appName);
  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  const compiler = findFrontierCompiler();
  if (compiler) {
    console.log('   1. Compiling Frontier → ARM64...');
    const compiled = compileFrontier(frontierFile, join(buildDir, 'libapp.so'), {
      target: 'aarch64-linux-android'
    });
    if (!compiled.ok) console.log(`   ⚠️  ${compiled.error}: ${compiled.detail || compiled.hint || ''}`);
  } else {
    console.log('   ⚠️  Frontier compiler not found — packaging runtime shell only');
  }

  console.log('   2. Bundling Frontier Mobile Runtime...');
  const runtimeLib = join(ROOT, 'mobile', 'frontier-runtime', 'target', 'aarch64-linux-android', 'release', 'libfrontier_app.so');
  const desktopRuntime = join(ROOT, 'mobile', 'frontier-runtime', 'target', 'release', 'libfrontier_app.so');
  if (existsSync(runtimeLib)) {
    copyFileSync(runtimeLib, join(buildDir, 'libfrontier_runtime.so'));
  } else if (existsSync(desktopRuntime)) {
    copyFileSync(desktopRuntime, join(buildDir, 'libfrontier_runtime.so'));
  }

  console.log('   3. Packaging via Gradle shell...');
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const apkPath = join(OUTPUT_DIR, `${slugify(appName)}-arm64.apk`);
  const packaged = buildNativeApk(apkPath);
  if (packaged.ok) {
    console.log(`   ✅ ${apkPath}`);
    return apkPath;
  }

  console.log(`   ⚠️  ${packaged.error}`);
  console.log(`   Build artifacts: ${buildDir}`);
  return null;
}

async function buildIOSApp(frontierFile, appName) {
  console.log(`\n📱 Building iOS App: ${appName}`);

  const buildDir = join(ROOT, 'build', 'ios', appName);
  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  const compiler = findFrontierCompiler();
  if (compiler) {
    console.log('   1. Compiling Frontier → iOS ARM64...');
    compileFrontier(frontierFile, join(buildDir, 'libapp.a'), { target: 'aarch64-apple-ios' });
  }

  const iosTar = join(OUTPUT_DIR, `lighthouse-${slugify(appName)}-ios.tar.gz`);
  const result = packageIosProject(iosTar);
  if (result.ok) {
    console.log(`   ✅ ${iosTar}`);
    return iosTar;
  }

  console.log(`   ⚠️  ${result.error}`);
  return buildDir;
}

async function main() {
  const args = process.argv.slice(2);
  const frontierFile = args[0];
  const appName = args[1] || 'lighthouse-app';

  if (!frontierFile) {
    console.log('Usage: node scripts/build-frontier-mobile.js <app.fr> [app-name]');
    process.exit(1);
  }
  if (!existsSync(frontierFile)) {
    console.error(`❌ File not found: ${frontierFile}`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('═'.repeat(60));
  console.log('FRONTIER MOBILE BUILDER');
  console.log('═'.repeat(60));
  console.log(`Source: ${frontierFile}`);
  console.log(`Frontier home: ${FRONTIER_HOME}`);

  const apk = await buildAndroidAPK(frontierFile, appName);
  const ios = await buildIOSApp(frontierFile, appName);

  console.log('\n' + '═'.repeat(60));
  console.log('BUILD COMPLETE');
  if (apk) console.log(`Android: ${apk}`);
  console.log(`iOS: ${ios}`);
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { buildAndroidAPK, buildIOSApp };
