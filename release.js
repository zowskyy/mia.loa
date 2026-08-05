#!/usr/bin/env node
/*
  LIGHTHOUSE UNIVERSAL RELEASE BUILDER v1.0.1

  Usage:
    node release.js all              Build every format
    node release.js desktop            All desktop platforms
    node release.js mobile             Android + iOS
    node release.js linux-arm64        Single platform
    node release.js portable
    node release.js docker
    node release.js assemble         # CI: checksums + manifest from releases/
    node release.js --dry-run          Preview what would be built

  Outputs to: ./releases/
*/

const { execSync } = require('child_process');
const {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  copyFileSync, rmSync, chmodSync, symlinkSync,
  createReadStream, statSync, readdirSync
} = require('fs');
const { join, basename, dirname } = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const RELEASE_DIR = join(ROOT, 'releases');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const VERSION = PKG.version;
const NAME = PKG.name;
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const BUILD_DATE = new Date().toISOString();

const PLATFORMS = {
  'linux-x64': {
    label: 'Linux (x64)', type: 'desktop', ext: 'tar.gz', os: 'linux', arch: 'x64',
    includesModel: true, notes: 'For most Linux desktops and servers. Intel/AMD 64-bit.'
  },
  'linux-arm64': {
    label: 'Linux (ARM64) — Raspberry Pi 4/5', type: 'desktop', ext: 'tar.gz', os: 'linux', arch: 'arm64',
    includesModel: true, notes: 'For Raspberry Pi 4, 5, Orange Pi 5, and other ARM64 SBCs.'
  },
  'linux-armv7l': {
    label: 'Linux (ARMv7) — Raspberry Pi 2/3', type: 'desktop', ext: 'tar.gz', os: 'linux', arch: 'armv7l',
    includesModel: true, notes: 'For Raspberry Pi 2, 3, and older ARM boards. 32-bit.'
  },
  'macos-x64': {
    label: 'macOS (Intel)', type: 'desktop', ext: 'tar.gz', os: 'darwin', arch: 'x64',
    includesModel: true, notes: 'For Intel-based Macs. macOS 11+ (Big Sur or newer).'
  },
  'macos-arm64': {
    label: 'macOS (Apple Silicon)', type: 'desktop', ext: 'tar.gz', os: 'darwin', arch: 'arm64',
    includesModel: true, notes: 'For M1/M2/M3 Macs. macOS 11+ (Big Sur or newer).'
  },
  'windows-x64': {
    label: 'Windows (x64)', type: 'desktop', ext: 'zip', os: 'win32', arch: 'x64',
    includesModel: true, notes: 'For Windows 10/11 64-bit. Includes .bat launcher.'
  },
  'android-arm64': {
    label: 'Android (ARM64) — Frontier Native APK', type: 'mobile', ext: 'apk', os: 'android', arch: 'arm64-v8a',
    includesModel: false, notes: 'Pure native APK (~3MB). No WebView. Set LIGHTHOUSE_MOBILE=capacitor for legacy build.'
  },
  'android-armv7': {
    label: 'Android (ARMv7) — Frontier Native APK', type: 'mobile', ext: 'apk', os: 'android', arch: 'armeabi-v7a',
    includesModel: false, notes: 'For older Android devices. Same universal APK as ARM64 build.',
    aliasOf: 'android-arm64'
  },
  'ios': {
    label: 'iOS — Frontier Native Shell', type: 'mobile', ext: 'tar.gz', os: 'ios', arch: 'universal',
    includesModel: false, notes: 'Xcode shell + libfrontier_app.a. No WebView. Build IPA on macOS.'
  },
  'portable': {
    label: 'Portable (Any Platform, No Model)', type: 'portable', ext: 'zip', os: 'any', arch: 'any',
    includesModel: false, notes: 'Lightweight version. Run "node setup.js" after extracting.'
  },
  'docker': {
    label: 'Docker Image', type: 'special', ext: 'tar', os: 'any', arch: 'any',
    includesModel: false, notes: 'Docker image for server deployment. Model mounted as volume.'
  },
  'rpi-installer': {
    label: 'Raspberry Pi Installer Package', type: 'special', ext: 'tar.gz', os: 'linux', arch: 'arm64',
    includesModel: true, notes: 'RPi installer script + Lighthouse + model. Not a raw SD image.'
  },
  'community-kit': {
    label: 'Complete Community Kit', type: 'special', ext: 'tar.gz', os: 'any', arch: 'any',
    includesModel: true, notes: 'Full kit: Lighthouse + model + docs + training + deployment scripts.'
  }
};

const CORE_FILES = [
  'core.js', 'setup.js', 'package.json', 'README.md',
  'lighthouse', 'lighthouse.bat', 'deploy.js', 'release.js',
  'lib/frontier.js', 'lib/frontier-codegen.js', 'lib/frontier-mobile.js',
  'scripts/frontier-codegen.js', 'scripts/build-frontier-mobile.js',
  'scripts/build-frontier-server.js', 'scripts/build-frontier-standalone.js',
  'scripts/frontier-cross-compile.js', 'scripts/frontier-single-binary.js',
  'scripts/frontier-http-server.js', 'scripts/frontier-ui-bindings.js',
  'scripts/frontier-ai-bindings.js', 'scripts/frontier-model-embed.js',
  'scripts/lib/frontier-utils.js',
  'scripts/sync-frontier-syntax.sh', 'mobile/build-native.sh'
];

const PUBLIC_FILES = [
  'index.html', 'client.js', 'mobile.js', 'mobile.css', 'sw.js', 'manifest.json',
  'webllm.js', 'webllm-bridge.js', 'connect.html', 'investor.html', 'i18n.js',
  'frontier-parser.js', 'browser-compiler.js', 'download-menu.js',
  'syntax/token_regex_table.json', 'syntax/README.md'
];

const MODEL_FILE = join('models', 'model.gguf');

const KIT_EXCLUDE_DIRS = new Set([
  'node_modules', 'releases', '.git', 'deploy', 'mobile/capacitor/node_modules',
  'mobile/capacitor/www', 'mobile/capacitor/android', 'mobile/capacitor/ios'
]);

function generateReleaseNotes() {
  const desktop = Object.entries(PLATFORMS).filter(([, p]) => p.type === 'desktop');
  const mobile = Object.entries(PLATFORMS).filter(([, p]) => p.type === 'mobile');
  const special = Object.entries(PLATFORMS).filter(([, p]) => p.type === 'special' || p.type === 'portable');

  return `# Lighthouse v${VERSION} — Universal Release

**Build ID:** ${BUILD_ID}
**Build Date:** ${BUILD_DATE}
**License:** MIT — Free Forever

## What is Lighthouse?

A **free, offline AI coding agent** that turns ideas into working software.
No subscription. No cloud. No API keys. Works on phones, Raspberry Pis, and old laptops.

## ARC Self-Review Cycle

1. **Analysis** — Understands what you need
2. **Plan** — Creates a step-by-step implementation plan
3. **Code** — Generates complete working software
4. **Review** — Self-critiques and refines until quality threshold met

## Desktop (${desktop.length} platforms)

${desktop.map(([k, p]) => `- **${k}** — \`${NAME}-${VERSION}-${k}.${p.ext}\` — ${p.notes}`).join('\n')}

## Mobile (${mobile.length} platforms)

${mobile.map(([k, p]) => `- **${k}** — \`${NAME}-${VERSION}-${k}.${p.ext}\` — ${p.notes}`).join('\n')}

## Special & Portable

${special.map(([k, p]) => `- **${k}** — \`${NAME}-${VERSION}-${k}.${p.ext}\` — ${p.notes}`).join('\n')}

## Quick Start

\`\`\`bash
tar -xzf lighthouse-${VERSION}-linux-x64.tar.gz
cd lighthouse-${VERSION}-linux-x64
npm install --production
node core.js
\`\`\`

## SHA256 Checksums

\`\`\`bash
sha256sum -c SHA256SUMS
\`\`\`

*Lighthouse is MIT licensed. Free forever. No exceptions.*
`;
}

function step(msg) { console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function err(msg) { console.log(`  ❌ ${msg}`); }

function copyTree(src, dest, rel = '') {
  if (!existsSync(src)) return;
  const st = statSync(src);
  if (st.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      if (!rel && KIT_EXCLUDE_DIRS.has(entry)) continue;
      if (rel && KIT_EXCLUDE_DIRS.has(join(rel, entry).replace(/\\/g, '/'))) continue;
      copyTree(join(src, entry), join(dest, entry), rel ? join(rel, entry) : entry);
    }
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

function copyReleaseFiles(buildDir, { includeModel = false, includePublic = true } = {}) {
  for (const file of CORE_FILES) {
    const src = join(ROOT, file);
    const dest = join(buildDir, file);
    if (existsSync(src)) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
  }
  if (includePublic) {
    const publicBuildDir = join(buildDir, 'public');
    mkdirSync(publicBuildDir, { recursive: true });
    if (existsSync(join(buildDir, 'public', 'impact'))) {
      // preserve impact if already copied
    }
    const impactSrc = join(ROOT, 'public', 'impact');
    if (existsSync(impactSrc)) {
      copyTree(impactSrc, join(publicBuildDir, 'impact'));
    }
    for (const file of PUBLIC_FILES) {
      const src = join(ROOT, 'public', file);
      const dest = join(publicBuildDir, file);
      if (existsSync(src)) copyFileSync(src, dest);
    }
  }
  mkdirSync(join(buildDir, 'projects'), { recursive: true });
  if (includeModel) {
    const modelSrc = join(ROOT, MODEL_FILE);
    const modelDest = join(buildDir, MODEL_FILE);
    if (existsSync(modelSrc)) {
      mkdirSync(dirname(modelDest), { recursive: true });
      copyFileSync(modelSrc, modelDest);
      return true;
    }
  }
  return false;
}

function checkPrerequisites() {
  step('Checking Prerequisites');
  const checks = [];

  const majorVersion = parseInt(process.version.slice(1).split('.')[0]);
  if (majorVersion >= 18) { ok(`Node.js ${process.version}`); checks.push(true); }
  else { err(`Node.js 18+ required (${process.version})`); checks.push(false); }

  for (const tool of ['tar', 'gzip', 'zip']) {
    try {
      execSync(process.platform === 'win32' ? `where ${tool}` : `command -v ${tool}`, { stdio: 'ignore' });
      ok(`${tool} found`);
    } catch {
      warn(`${tool} not found — some builds may fail`);
    }
  }

  for (const file of CORE_FILES) {
    if (!existsSync(join(ROOT, file))) {
      err(`Missing: ${file}`);
      checks.push(false);
    }
  }
  ok('Core files verified');

  for (const file of PUBLIC_FILES) {
    if (!existsSync(join(ROOT, 'public', file))) {
      warn(`Missing public/${file}`);
    }
  }

  const modelPath = join(ROOT, MODEL_FILE);
  if (existsSync(modelPath)) {
    ok(`Model found (${(statSync(modelPath).size / 1024 / 1024 / 1024).toFixed(1)}GB)`);
  } else {
    warn('Model not found — run "node setup.js" for model-inclusive builds');
  }

  if (!checks.every(Boolean)) process.exit(1);
}

async function generateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(`${hash.digest('hex')}  ${basename(filePath)}`));
    stream.on('error', reject);
  });
}

function createArchive(buildDir, outputFile, ext) {
  const releaseName = basename(buildDir);
  if (ext === 'zip') {
    if (process.platform === 'win32') {
      const parent = dirname(buildDir).replace(/'/g, "''");
      const folder = releaseName.replace(/'/g, "''");
      const dest = outputFile.replace(/'/g, "''");
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${parent}/${folder}' -DestinationPath '${dest}' -Force"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`cd "${dirname(buildDir)}" && zip -r "${outputFile}" "${releaseName}" -q`, { stdio: 'pipe' });
    }
  } else if (ext === 'tar.gz' || ext === 'tar') {
    execSync(`cd "${dirname(buildDir)}" && tar -czf "${outputFile}" "${releaseName}"`, { stdio: 'pipe' });
  }
}

async function finalizeBuild(platformKey, outputFile, buildDir) {
  if (!existsSync(outputFile)) return false;
  const checksum = await generateChecksum(outputFile);
  writeFileSync(outputFile + '.sha256', checksum);
  if (buildDir && existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  const sizeMB = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
  ok(`${sizeMB} MB — ${basename(outputFile)}`);
  return { platformKey, outputFile, sizeMB, checksum };
}

async function buildDesktop(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform || platform.type !== 'desktop') return false;

  const releaseName = `${NAME}-${VERSION}-${platformKey}`;
  const buildDir = join(RELEASE_DIR, 'build', releaseName);
  const outputFile = join(RELEASE_DIR, `${releaseName}.${platform.ext}`);

  console.log(`\n  📦 ${platform.label}`);
  console.log(`     Output: ${basename(outputFile)}`);

  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  if (copyReleaseFiles(buildDir, { includeModel: platform.includesModel })) {
    console.log('     📦 Model included');
  }

  if (platform.ext === 'tar.gz') {
    const launcher = join(buildDir, 'lighthouse');
    if (existsSync(launcher)) chmodSync(launcher, 0o755);
  }

  writeFileSync(join(buildDir, 'INSTALL.md'), `# Lighthouse v${VERSION} — ${platform.label}

## Quick Start
${platform.ext === 'zip'
    ? `1. Extract zip\n2. npm install --production\n3. node core.js\n4. Open http://localhost:8899`
    : `1. tar -xzf ${releaseName}.tar.gz\n2. cd ${releaseName}\n3. npm install --production\n4. node core.js`
}

## Notes
${platform.notes}
`);

  createArchive(buildDir, outputFile, platform.ext);
  return finalizeBuild(platformKey, outputFile, buildDir);
}

let androidApkBuilt = null;

function isCI() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

function ensureCapacitorDeps(capacitorDir) {
  if (!existsSync(join(capacitorDir, 'package.json'))) {
    warn('Capacitor project not found at mobile/capacitor/');
    return false;
  }
  if (!existsSync(join(capacitorDir, 'node_modules'))) {
    console.log('     Installing Capacitor dependencies...');
    execSync('npm install', { cwd: capacitorDir, stdio: 'pipe' });
  }
  return true;
}

function signAndroidApk(unsignedApk, signedApk) {
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdkRoot) return false;

  const buildToolsDir = join(sdkRoot, 'build-tools');
  if (!existsSync(buildToolsDir)) return false;

  const buildTools = readdirSync(buildToolsDir)
    .filter(name => /^\d/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  if (!buildTools) return false;

  const apksigner = join(buildToolsDir, buildTools, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
  if (!existsSync(apksigner)) return false;

  const keystore = join(process.env.HOME || process.env.USERPROFILE || '', '.android', 'debug.keystore');
  if (!existsSync(keystore)) {
    execSync(
      `keytool -genkey -v -keystore "${keystore}" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`,
      { stdio: 'pipe' }
    );
  }

  copyFileSync(unsignedApk, signedApk);
  execSync(
    `"${apksigner}" sign --ks "${keystore}" --ks-pass pass:android --key-pass pass:android --out "${signedApk}" "${unsignedApk}"`,
    { stdio: 'pipe' }
  );
  return existsSync(signedApk);
}

let androidApkBuilt = null;

const { buildNativeApk, packageIosProject } = require('./lib/frontier-mobile');

function useCapacitorMobile() {
  return process.env.LIGHTHOUSE_MOBILE === 'capacitor';
}

async function buildFrontierNativeAndroid(platformKey) {
  const outputFile = join(RELEASE_DIR, `${NAME}-${VERSION}-${platformKey}.apk`);
  console.log('     Stack: Frontier native (libfrontier_app.so — no WebView)');

  try {
    const result = buildNativeApk(outputFile);
    if (!result.ok) {
      warn(result.error || 'Frontier native APK build failed');
      return false;
    }

    androidApkBuilt = outputFile;
    const built = await finalizeBuild(platformKey, outputFile, null);

    if (platformKey === 'android-arm64') {
      const armv7File = join(RELEASE_DIR, `${NAME}-${VERSION}-android-armv7.apk`);
      copyFileSync(outputFile, armv7File);
      const armv7Checksum = await generateChecksum(armv7File);
      writeFileSync(armv7File + '.sha256', armv7Checksum);
      ok('android-armv7 alias APK created');
    }

    return built;
  } catch (e) {
    warn(`Frontier native APK: ${e.message}`);
    return false;
  }
}

async function buildCapacitorAndroidAPK(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform || platform.type !== 'mobile' || !platformKey.startsWith('android')) return false;

  const releaseName = `${NAME}-${VERSION}-${platformKey}`;
  const outputFile = join(RELEASE_DIR, `${releaseName}.apk`);

  console.log(`\n  📱 Building Capacitor Android APK: ${platform.label}`);
  console.log(`     Output: ${basename(outputFile)}`);

  const capacitorDir = join(ROOT, 'mobile', 'capacitor');
  if (!ensureCapacitorDeps(capacitorDir)) return false;

  if (!existsSync(join(capacitorDir, 'android'))) {
    console.log('     Adding Android platform...');
    execSync('npx cap add android', { cwd: capacitorDir, stdio: 'pipe' });
  }

  console.log('     Building web assets...');
  execSync('node build-mobile.js', { cwd: capacitorDir, stdio: 'pipe' });

  console.log('     Syncing to Android...');
  execSync('npx cap sync android', { cwd: capacitorDir, stdio: 'pipe' });

  const androidDir = join(capacitorDir, 'android');
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  if (!existsSync(join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'))) {
    warn('gradlew not found — run: npx cap add android');
    return false;
  }

  if (process.platform !== 'win32') {
    execSync('chmod +x gradlew', { cwd: androidDir, stdio: 'pipe' });
  }

  const gradleTarget = isCI() ? 'assembleRelease' : 'assembleDebug';
  console.log(`     Building APK via ${gradleTarget} (may take several minutes)...`);

  try {
    execSync(`${gradlew} ${gradleTarget}`, { cwd: androidDir, stdio: 'pipe', timeout: 600000 });

    const apkCandidates = [
      join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
      join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk'),
      join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    ];

    let builtAPK = apkCandidates.find(path => existsSync(path));
    if (!builtAPK) {
      warn('APK not found after Gradle build');
      return false;
    }

    if (builtAPK.includes('unsigned')) {
      const signedPath = join(RELEASE_DIR, 'build', 'signed.apk');
      mkdirSync(dirname(signedPath), { recursive: true });
      if (signAndroidApk(builtAPK, signedPath)) {
        builtAPK = signedPath;
        ok('Signed release APK with debug keystore');
      } else if (isCI()) {
        warn('Could not sign APK — trying debug build');
        execSync(`${gradlew} assembleDebug`, { cwd: androidDir, stdio: 'pipe', timeout: 600000 });
        builtAPK = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
      }
    }

    if (!builtAPK || !existsSync(builtAPK)) {
      warn('No installable APK produced');
      return false;
    }

    copyFileSync(builtAPK, outputFile);
    androidApkBuilt = outputFile;
    const result = await finalizeBuild(platformKey, outputFile, null);

    if (platformKey === 'android-arm64') {
      const armv7File = join(RELEASE_DIR, `${NAME}-${VERSION}-android-armv7.apk`);
      copyFileSync(outputFile, armv7File);
      const armv7Checksum = await generateChecksum(armv7File);
      writeFileSync(armv7File + '.sha256', armv7Checksum);
      ok('android-armv7 alias APK created');
    }

    return result;
  } catch (e) {
    warn(`Android build failed: ${e.message}`);
    warn('Install Android Studio or set ANDROID_SDK_ROOT with platform 34 + build-tools 34.0.0');
    return false;
  }
}

async function buildMobile(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform || platform.type !== 'mobile') return false;

  if (platform.aliasOf) {
    const srcFile = join(RELEASE_DIR, `${NAME}-${VERSION}-${platform.aliasOf}.apk`);
    const outputFile = join(RELEASE_DIR, `${NAME}-${VERSION}-${platformKey}.apk`);
    if (!existsSync(srcFile)) {
      warn(`Alias ${platformKey}: build ${platform.aliasOf} first`);
      return false;
    }
    console.log(`\n  📱 ${platform.label} (alias of ${platform.aliasOf})`);
    copyFileSync(srcFile, outputFile);
    const checksum = await generateChecksum(outputFile);
    writeFileSync(outputFile + '.sha256', checksum);
    const sizeMB = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
    ok(`${sizeMB} MB — ${basename(outputFile)} (shared APK)`);
    return { platformKey, outputFile, sizeMB, checksum };
  }

  const releaseName = `${NAME}-${VERSION}-${platformKey}`;
  const outputFile = join(RELEASE_DIR, `${releaseName}.${platform.ext}`);

  console.log(`\n  📱 ${platform.label}`);
  console.log(`     Output: ${basename(outputFile)}`);

  const capacitorDir = join(ROOT, 'mobile', 'capacitor');

  if (platformKey === 'ios') {
    if (!useCapacitorMobile()) {
      console.log('     Stack: Frontier native (libfrontier_app.a — no WebView)');
      try {
        const result = packageIosProject(outputFile);
        if (result.ok) {
          return finalizeBuild(platformKey, outputFile, null);
        }
        warn(result.error || 'Frontier iOS package failed');
      } catch (e) {
        warn(`Frontier iOS: ${e.message}`);
      }
      warn('Falling back to Capacitor WebView iOS project');
    }

    if (!ensureCapacitorDeps(capacitorDir)) return false;
    if (!existsSync(join(capacitorDir, 'ios'))) {
      console.log('     Adding iOS platform...');
      execSync('npx cap add ios', { cwd: capacitorDir, stdio: 'pipe' });
    }
    console.log('     Building web assets...');
    execSync('node build-mobile.js', { cwd: capacitorDir, stdio: 'pipe' });
    execSync('npx cap sync ios', { cwd: capacitorDir, stdio: 'pipe' });

    const iosDir = join(capacitorDir, 'ios');
    const buildDir = join(RELEASE_DIR, 'build', releaseName);
    if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
    copyTree(iosDir, buildDir);
    writeFileSync(join(buildDir, 'BUILD_INSTRUCTIONS.md'),
      `# Building Lighthouse for iOS\n\n1. Open App/App.xcworkspace in Xcode\n2. Configure signing team\n3. Product > Archive\n4. Distribute to TestFlight or App Store\n`);
    createArchive(buildDir, outputFile, 'tar.gz');
    return finalizeBuild(platformKey, outputFile, buildDir);
  }

  if (platformKey.startsWith('android')) {
    if (!useCapacitorMobile()) {
      const native = await buildFrontierNativeAndroid(platformKey);
      if (native) return native;
      warn('Falling back to Capacitor WebView APK');
    }
    if (!ensureCapacitorDeps(capacitorDir)) return false;
    return buildCapacitorAndroidAPK(platformKey);
  }

  return false;
}

async function buildPortable(platformKey = 'portable') {
  const platform = PLATFORMS[platformKey];
  if (!platform || platform.type !== 'portable') return false;

  const releaseName = `${NAME}-${VERSION}-${platformKey}`;
  const buildDir = join(RELEASE_DIR, 'build', releaseName);
  const outputFile = join(RELEASE_DIR, `${releaseName}.${platform.ext}`);

  console.log(`\n  🎒 ${platform.label}`);

  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });
  copyReleaseFiles(buildDir, { includeModel: false });
  mkdirSync(join(buildDir, 'models'), { recursive: true });

  writeFileSync(join(buildDir, 'GET_MODEL.md'),
    `# Download the AI Model\n\n\`\`\`bash\nnode setup.js\n\`\`\`\n\nDownloads ~4GB one time. Then fully offline.\n`);

  createArchive(buildDir, outputFile, 'zip');
  return finalizeBuild(platformKey, outputFile, buildDir);
}

async function buildDocker() {
  const outputFile = join(RELEASE_DIR, `${NAME}-${VERSION}-docker.tar`);
  console.log(`\n  🐳 Docker Image`);

  const dockerDir = join(RELEASE_DIR, 'build', 'docker');
  if (existsSync(dockerDir)) rmSync(dockerDir, { recursive: true });
  mkdirSync(dockerDir, { recursive: true });
  copyReleaseFiles(dockerDir, { includeModel: false });
  mkdirSync(join(dockerDir, 'models'), { recursive: true });

  writeFileSync(join(dockerDir, 'Dockerfile'),
    `FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install --production\nEXPOSE 8899\nENV NODE_ENV=production\nVOLUME ["/app/models", "/app/projects"]\nCMD ["node", "core.js"]\n`);

  writeFileSync(join(dockerDir, 'docker-compose.yml'),
    `services:\n  lighthouse:\n    build: .\n    ports:\n      - "8899:8899"\n    volumes:\n      - ./models:/app/models\n      - ./projects:/app/projects\n    restart: unless-stopped\n`);

  try {
    execSync(`docker build -t lighthouse:${VERSION} -t lighthouse:latest "${dockerDir}"`,
      { stdio: 'pipe', timeout: 300000 });
    execSync(`docker save -o "${outputFile}" lighthouse:${VERSION} lighthouse:latest`,
      { stdio: 'pipe' });
    rmSync(dockerDir, { recursive: true });
    return finalizeBuild('docker', outputFile, null);
  } catch (e) {
    warn(`Docker build skipped: ${e.message}`);
    warn(`Dockerfile saved at ${dockerDir} for manual build`);
    return false;
  }
}

async function buildRPiInstaller() {
  const platformKey = 'rpi-installer';
  const outputFile = join(RELEASE_DIR, `${NAME}-${VERSION}-rpi-installer.tar.gz`);
  console.log(`\n  🍓 Raspberry Pi Installer Package`);
  warn('Full SD .img requires root + physical media — shipping installer tarball instead');

  const installerDir = join(RELEASE_DIR, 'build', 'rpi-installer');
  if (existsSync(installerDir)) rmSync(installerDir, { recursive: true });
  mkdirSync(installerDir, { recursive: true });

  if (copyReleaseFiles(installerDir, { includeModel: true })) ok('Model included');

  writeFileSync(join(installerDir, 'install.sh'), `#!/bin/bash
set -e
echo "🍓 Lighthouse RPi Installer v${VERSION}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git
sudo mkdir -p /opt/lighthouse
sudo cp -r . /opt/lighthouse/
cd /opt/lighthouse && npm install --production
sudo tee /etc/systemd/system/lighthouse.service > /dev/null << 'EOF'
[Unit]
Description=Lighthouse AI Coding Agent
After=network.target
[Service]
Type=simple
ExecStart=/usr/bin/node /opt/lighthouse/core.js
WorkingDirectory=/opt/lighthouse
Restart=on-failure
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable lighthouse && sudo systemctl start lighthouse
echo "✅ http://$(hostname -I | awk '{print $1}'):8899"
`);
  chmodSync(join(installerDir, 'install.sh'), 0o755);

  execSync(`cd "${RELEASE_DIR}/build" && tar -czf "${outputFile}" rpi-installer`, { stdio: 'pipe' });
  rmSync(installerDir, { recursive: true });
  return finalizeBuild(platformKey, outputFile, null);
}

async function buildCommunityKit() {
  const platformKey = 'community-kit';
  const outputFile = join(RELEASE_DIR, `${NAME}-${VERSION}-community-kit.tar.gz`);
  console.log(`\n  🏘️  Complete Community Kit`);

  const deployScript = join(ROOT, 'deploy.js');
  if (existsSync(deployScript)) {
    try {
      console.log('     Running deployment builder...');
      execSync(`node "${deployScript}" all global`, { stdio: 'pipe', cwd: ROOT, timeout: 120000 });
      ok('Deployment packages built');
    } catch (e) {
      warn(`Deployment builder: ${e.message}`);
    }
  }

  const kitDir = join(RELEASE_DIR, 'build', 'community-kit');
  if (existsSync(kitDir)) rmSync(kitDir, { recursive: true });
  mkdirSync(kitDir, { recursive: true });

  const COPY_ROOT_ITEMS = [
    'core.js', 'setup.js', 'package.json', 'README.md', 'RELEASE_NOTES.md',
    'lighthouse', 'lighthouse.bat', 'deploy.js', 'release.js', 'deploy.sh', 'release.sh',
    'RELEASE_CHECKLIST.md', 'public', 'mobile', 'models'
  ];

  for (const item of COPY_ROOT_ITEMS) {
    const src = join(ROOT, item);
    if (existsSync(src)) copyTree(src, join(kitDir, item));
  }

  const deployOutput = join(ROOT, 'deploy');
  if (existsSync(deployOutput)) copyTree(deployOutput, join(kitDir, 'deploy'));

  execSync(`cd "${RELEASE_DIR}/build" && tar -czf "${outputFile}" community-kit`, { stdio: 'pipe' });
  rmSync(kitDir, { recursive: true });
  return finalizeBuild(platformKey, outputFile, null);
}

function platformKeyFromFilename(filename) {
  const prefix = `${NAME}-${VERSION}-`;
  if (!filename.startsWith(prefix)) return null;
  const rest = filename.slice(prefix.length);
  for (const [key, p] of Object.entries(PLATFORMS)) {
    if (rest === `${key}.${p.ext}`) return key;
  }
  return null;
}

async function assembleReleaseArtifacts() {
  step('Assembling Release Artifacts');
  if (!existsSync(RELEASE_DIR)) mkdirSync(RELEASE_DIR, { recursive: true });

  const artifactPattern = new RegExp(`^${NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${VERSION}-.+\\.(tar\\.gz|zip|apk|tar)$`);
  const results = [];

  for (const entry of readdirSync(RELEASE_DIR)) {
    if (!artifactPattern.test(entry)) continue;
    const outputFile = join(RELEASE_DIR, entry);
    if (!statSync(outputFile).isFile()) continue;

    const platformKey = platformKeyFromFilename(entry);
    const checksum = await generateChecksum(outputFile);
    writeFileSync(outputFile + '.sha256', checksum);
    const sizeMB = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
    results.push({ platformKey: platformKey || entry, outputFile, sizeMB, checksum });
    ok(`${entry} (${sizeMB} MB)`);
  }

  if (!results.length) {
    warn('No release artifacts found in releases/');
    return [];
  }

  const known = results.filter(r => PLATFORMS[r.platformKey]);
  writeSHA256SUMS(known.length ? known : results);
  generateManifest(known.length ? known : results);
  createLatestSymlinks(known);

  const notes = generateReleaseNotes();
  writeFileSync(join(RELEASE_DIR, 'RELEASE_NOTES.md'), notes);
  writeFileSync(join(ROOT, 'RELEASE_NOTES.md'), notes);
  ok('RELEASE_NOTES.md generated');

  console.log(`\n  Assembled ${results.length} release artifact(s)`);
  return results;
}

function writeSHA256SUMS(results) {
  const valid = results.filter(r => r && r.checksum);
  if (!valid.length) return;
  writeFileSync(join(RELEASE_DIR, 'SHA256SUMS'), valid.map(r => r.checksum).join('\n') + '\n');
  ok('SHA256SUMS generated');
}

function generateManifest(results) {
  const manifest = {
    name: NAME, version: VERSION, buildId: BUILD_ID, buildDate: BUILD_DATE,
    license: 'MIT', totalFormats: results.filter(Boolean).length, formats: {}
  };
  results.filter(Boolean).forEach(r => {
    const platform = PLATFORMS[r.platformKey];
    manifest.formats[r.platformKey] = {
      label: platform?.label || r.platformKey,
      type: platform?.type || 'unknown',
      filename: basename(r.outputFile),
      sizeMB: r.sizeMB,
      sha256: r.checksum?.split(' ')[0] || null,
      includesModel: platform?.includesModel || false
    };
  });
  writeFileSync(join(RELEASE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  ok('manifest.json generated');
}

function createLatestSymlinks(results) {
  results.filter(Boolean).forEach(r => {
    const platform = PLATFORMS[r.platformKey];
    if (!platform) return;
    const latest = join(RELEASE_DIR, `${NAME}-latest-${r.platformKey}.${platform.ext}`);
    try {
      if (existsSync(latest)) rmSync(latest);
      symlinkSync(basename(r.outputFile), latest);
    } catch {
      copyFileSync(r.outputFile, latest);
    }
  });
  ok('Latest symlinks created');
}

function printDryRun() {
  console.log('\n🔍 DRY RUN — formats that would be built:\n');
  for (const [key, p] of Object.entries(PLATFORMS)) {
    const alias = p.aliasOf ? ` (alias → ${p.aliasOf})` : '';
    console.log(`  📦 ${NAME}-${VERSION}-${key}.${p.ext}`.padEnd(52) + p.label + alias);
  }
  console.log('\n  Artifacts: SHA256SUMS, manifest.json, RELEASE_NOTES.md\n');
}

async function main() {
  const args = process.argv.slice(2);
  const filter = args[0] || 'all';

  if (filter === '--dry-run' || filter === '--platform' || filter === '--platforms') {
    printDryRun();
    return;
  }

  if (filter === 'assemble') {
    console.log(`\n⚡ Lighthouse Release Assembler v${VERSION}\n`);
    await assembleReleaseArtifacts();
    return;
  }

  console.log(`\n⚡ Lighthouse Universal Release Builder v${VERSION}`);
  console.log(`Build ID: ${BUILD_ID}`);
  console.log(`Output: ${RELEASE_DIR}\n`);

  if (!existsSync(RELEASE_DIR)) mkdirSync(RELEASE_DIR, { recursive: true });
  checkPrerequisites();

  const results = [];
  const startTime = Date.now();
  androidApkBuilt = null;

  const buildAll = filter === 'all';
  const buildDesktopOnly = filter === 'desktop';
  const buildMobileOnly = filter === 'mobile';
  const buildSpecific = PLATFORMS[filter];

  if (buildAll || buildDesktopOnly) {
    step('Building Desktop Releases');
    for (const [key, p] of Object.entries(PLATFORMS)) {
      if (p.type === 'desktop') results.push(await buildDesktop(key));
    }
  }

  if (buildAll || buildMobileOnly) {
    step('Building Mobile Releases');
    for (const [key, p] of Object.entries(PLATFORMS)) {
      if (p.type === 'mobile') results.push(await buildMobile(key));
    }
  }

  if (buildAll || filter === 'portable') {
    step('Building Portable Release');
    results.push(await buildPortable('portable'));
  }

  if (buildAll || filter === 'docker') {
    step('Building Docker Release');
    results.push(await buildDocker());
  }

  if (buildAll || filter === 'rpi-installer' || filter === 'rpi-sd-image') {
    step('Building Raspberry Pi Installer');
    results.push(await buildRPiInstaller());
  }

  if (buildAll || filter === 'community-kit') {
    step('Building Community Kit');
    results.push(await buildCommunityKit());
  }

  if (buildSpecific && !buildAll && !['desktop', 'mobile', 'portable', 'docker', 'rpi-installer', 'rpi-sd-image', 'community-kit'].includes(filter)) {
    if (buildSpecific.type === 'desktop') results.push(await buildDesktop(filter));
    else if (buildSpecific.type === 'mobile') results.push(await buildMobile(filter));
    else if (buildSpecific.type === 'portable') results.push(await buildPortable(filter));
  }

  step('Generating Release Artifacts');
  const valid = results.filter(Boolean);
  writeSHA256SUMS(valid);
  generateManifest(valid);
  createLatestSymlinks(valid);

  const notes = generateReleaseNotes();
  writeFileSync(join(RELEASE_DIR, 'RELEASE_NOTES.md'), notes);
  writeFileSync(join(ROOT, 'RELEASE_NOTES.md'), notes);
  ok('RELEASE_NOTES.md generated');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  ✅ RELEASE BUILD COMPLETE');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Build ID: ${BUILD_ID}`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Formats: ${valid.length} built`);
  console.log(`\n  📁 ${RELEASE_DIR}/`);
  valid.forEach(r => console.log(`     ${basename(r.outputFile).padEnd(55)} ${r.sizeMB} MB`));
  console.log(`\n  Verify: sha256sum -c releases/SHA256SUMS\n`);
}

main().catch(e => {
  console.error('❌ Build failed:', e.message);
  process.exit(1);
});
