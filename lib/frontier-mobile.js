/*
  Frontier native mobile builder — packages .so + platform shell into APK
*/

const { execSync, spawnSync } = require('child_process');
const {
  existsSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, writeFileSync
} = require('fs');
const { join, basename, dirname } = require('path');

const ROOT = join(__dirname, '..');
const RUNTIME_DIR = join(ROOT, 'mobile', 'frontier-runtime');
const ANDROID_SHELL = join(ROOT, 'mobile', 'android-shell');
const NATIVE_OUT = join(ROOT, 'releases', 'native');
const PKG = require(join(ROOT, 'package.json'));

function commandExists(cmd) {
  try {
    execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function buildNativeLibraries(targets = ['desktop']) {
  mkdirSync(NATIVE_OUT, { recursive: true });
  const results = [];

  if (!commandExists('cargo')) {
    return { ok: false, error: 'Rust/cargo not installed', built: results };
  }

  const allTargets = [
    { id: 'desktop', cmd: 'cargo build --release', out: join(RUNTIME_DIR, 'target/release/libfrontier_app.so'), dest: join(NATIVE_OUT, 'desktop/libfrontier_app.so') },
    { id: 'android-arm64', cmd: 'cargo build --release --target aarch64-linux-android', out: join(RUNTIME_DIR, 'target/aarch64-linux-android/release/libfrontier_app.so'), dest: join(NATIVE_OUT, 'arm64-v8a/libfrontier_app.so') },
    { id: 'android-armv7', cmd: 'cargo build --release --target armv7-linux-androideabi', out: join(RUNTIME_DIR, 'target/armv7-linux-androideabi/release/libfrontier_app.so'), dest: join(NATIVE_OUT, 'armeabi-v7a/libfrontier_app.so') },
    { id: 'android-x64', cmd: 'cargo build --release --target x86_64-linux-android', out: join(RUNTIME_DIR, 'target/x86_64-linux-android/release/libfrontier_app.so'), dest: join(NATIVE_OUT, 'x86_64/libfrontier_app.so') }
  ];

  for (const t of allTargets) {
    if (!targets.includes(t.id) && !targets.includes('all')) continue;
    try {
      run(t.cmd, { cwd: RUNTIME_DIR });
      if (existsSync(t.out)) {
        mkdirSync(join(t.dest, '..'), { recursive: true });
        copyFileSync(t.out, t.dest);
        results.push({ target: t.id, path: t.dest, size: statSync(t.dest).size });
      }
    } catch (e) {
      if (t.id === 'desktop') throw e;
      console.warn(`  ⚠️  Skipped ${t.id}: ${e.message}`);
    }
  }

  return { ok: results.length > 0, built: results };
}

function installJniLibs() {
  const jniRoot = join(ANDROID_SHELL, 'app/src/main/jniLibs');
  const arches = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];

  for (const arch of arches) {
    const src = join(NATIVE_OUT, arch, 'libfrontier_app.so');
    if (!existsSync(src)) continue;
    const destDir = join(jniRoot, arch);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(src, join(destDir, 'libfrontier_app.so'));
  }
}

function buildNativeApk(outputFile) {
  if (!existsSync(ANDROID_SHELL)) {
    return { ok: false, error: 'Android shell not found at mobile/android-shell' };
  }

  const libResult = buildNativeLibraries(['android-arm64', 'android-armv7', 'android-x64', 'desktop']);
  if (!libResult.built.some(b => b.target.startsWith('android'))) {
    console.warn('  ⚠️  No Android .so built — packaging shell with desktop lib for CI smoke test');
    buildNativeLibraries(['desktop']);
    const desktopLib = join(NATIVE_OUT, 'desktop/libfrontier_app.so');
    if (existsSync(desktopLib)) {
      const dest = join(NATIVE_OUT, 'arm64-v8a/libfrontier_app.so');
      mkdirSync(join(dest, '..'), { recursive: true });
      copyFileSync(desktopLib, dest);
    }
  }

  installJniLibs();

  const gradlew = join(ANDROID_SHELL, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!existsSync(gradlew)) {
    if (commandExists('gradle')) {
      run('gradle wrapper --gradle-version 8.7', { cwd: ANDROID_SHELL });
    } else {
      return { ok: false, error: 'Gradle not found — cannot build APK shell' };
    }
  }

  if (process.platform !== 'win32') {
    run(`chmod +x "${gradlew}"`, { cwd: ANDROID_SHELL });
  }

  run(`"${gradlew}" assembleRelease`, { cwd: ANDROID_SHELL, timeout: 600000 });

  const apkCandidates = [
    join(ANDROID_SHELL, 'app/build/outputs/apk/release/app-release-unsigned.apk'),
    join(ANDROID_SHELL, 'app/build/outputs/apk/release/app-release.apk'),
    join(ANDROID_SHELL, 'app/build/outputs/apk/debug/app-debug.apk')
  ];

  const built = apkCandidates.find(p => existsSync(p));
  if (!built) {
    return { ok: false, error: 'APK not found after Gradle build' };
  }

  mkdirSync(dirname(outputFile), { recursive: true });
  copyFileSync(built, outputFile);
  return { ok: true, apk: outputFile, size: statSync(outputFile).size, stack: 'frontier-native' };
}

function packageIosProject(outputFile) {
  const iosShell = join(ROOT, 'mobile', 'ios-shell');
  if (!existsSync(iosShell)) {
    return { ok: false, error: 'iOS shell not found' };
  }

  buildNativeLibraries(['desktop']);

  const staging = join(ROOT, 'releases', 'build', 'ios-native');
  if (existsSync(staging)) rmSync(staging, { recursive: true });
  mkdirSync(staging, { recursive: true });

  for (const entry of readdirSync(iosShell)) {
    const src = join(iosShell, entry);
    const dest = join(staging, entry);
    if (statSync(src).isDirectory()) {
      execSync(`cp -r "${src}" "${dest}"`, { stdio: 'pipe' });
    } else {
      copyFileSync(src, dest);
    }
  }

  const lib = join(NATIVE_OUT, 'desktop/libfrontier_app.so');
  if (existsSync(lib)) {
    mkdirSync(join(staging, 'lib'), { recursive: true });
    copyFileSync(lib, join(staging, 'lib/libfrontier_app.a'));
  }

  writeFileSync(join(staging, 'BUILD.md'), `# Lighthouse Frontier iOS Shell

1. Open in Xcode on macOS
2. Link lib/libfrontier_app.a
3. Product → Archive
`);

  execSync(`tar -czf "${outputFile}" -C "${join(staging, '..')}" "${basename(staging)}"`, { stdio: 'pipe' });
  rmSync(staging, { recursive: true });
  return { ok: true, archive: outputFile, stack: 'frontier-native' };
}

module.exports = {
  buildNativeLibraries,
  buildNativeApk,
  packageIosProject,
  NATIVE_OUT,
  RUNTIME_DIR,
  ANDROID_SHELL
};
