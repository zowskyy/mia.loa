#!/usr/bin/env node
/*
  RELEASE BUILDER — Lighthouse v1.0.1
  Builds all distributable formats for every target platform.

  Usage:
    node release.js              # Build everything (deduplicated)
    node release.js --all        # Same as default
    node release.js linux-x64     # Build one platform
    node release.js --platform   # Show available platforms
    node release.js --dry-run      # Show what would be built

  Outputs to: ./releases/
*/

const { execSync } = require('child_process');
const {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  createReadStream, statSync, copyFileSync,
  rmSync, chmodSync, symlinkSync
} = require('fs');
const { join, basename, dirname } = require('path');
const crypto = require('crypto');

let archiver = null;
try { archiver = require('archiver'); } catch {}

const ROOT = __dirname;
const RELEASE_DIR = join(ROOT, 'releases');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
const NAME = 'lighthouse';
const BUILD_ID = `${Date.now().toString(36)}`;

const PLATFORMS = {
  'linux-x64': {
    label: 'Linux (x64)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: 'For most Linux desktops and servers',
    buildKey: 'linux-x64'
  },
  'linux-arm64': {
    label: 'Raspberry Pi 4/5 (ARM64)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: '64-bit ARM. RPi 4, RPi 5, Orange Pi 5',
    buildKey: 'linux-arm64'
  },
  'linux-armv7l': {
    label: 'Raspberry Pi 2/3 (ARMv7)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: '32-bit ARM. RPi 2, RPi 3, older boards',
    buildKey: 'linux-armv7l'
  },
  'macos-x64': {
    label: 'macOS (Intel)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: 'Intel Macs',
    buildKey: 'macos-x64'
  },
  'macos-arm64': {
    label: 'macOS (Apple Silicon)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: 'M1/M2/M3 Macs',
    buildKey: 'macos-arm64'
  },
  'win-x64': {
    label: 'Windows (x64)',
    ext: 'zip',
    binary: 'lighthouse.bat',
    notes: 'Windows 10/11 64-bit',
    buildKey: 'win-x64'
  },
  'android-termux': {
    label: 'Android (Termux)',
    ext: 'tar.gz',
    binary: 'lighthouse',
    notes: 'Termux on Android phones/tablets',
    buildKey: 'linux-arm64'
  },
  'portable': {
    label: 'Portable (Any Platform)',
    ext: 'zip',
    binary: 'lighthouse',
    notes: 'No model included. Run node setup.js after extracting.',
    noModel: true,
    buildKey: 'portable'
  }
};

function getUniqueBuilds(platformKeys) {
  const seen = new Set();
  const unique = [];
  for (const key of platformKeys) {
    const bk = PLATFORMS[key]?.buildKey || key;
    if (!seen.has(bk)) {
      seen.add(bk);
      unique.push(key);
    }
  }
  return unique;
}

function getAliasPlatforms(primaryKey) {
  const buildKey = PLATFORMS[primaryKey]?.buildKey || primaryKey;
  return Object.keys(PLATFORMS).filter(
    k => k !== primaryKey && (PLATFORMS[k]?.buildKey || k) === buildKey
  );
}

const CORE_FILES = [
  'core.js', 'setup.js', 'package.json', 'README.md',
  'public/index.html', 'public/client.js', 'public/mobile.js', 'public/mobile.css', 'public/sw.js',
  'lighthouse', 'lighthouse.bat'
];

function generateReleaseNotes(platform, platformKey) {
  const date = new Date().toISOString().split('T')[0];
  const extractCmd = platform.ext === 'zip'
    ? `unzip lighthouse-${VERSION}-${platformKey}.zip`
    : `tar -xzf lighthouse-${VERSION}-${platformKey}.tar.gz`;

  return `# Lighthouse v${VERSION} — ${platform.label}

**Release Date:** ${date}
**Build ID:** ${BUILD_ID}

## What is Lighthouse?

A free, offline AI coding agent. No subscription. No cloud.
Turn ideas into working software on any device.

## Quick Start

\`\`\`bash
${extractCmd}
cd lighthouse-${VERSION}
npm install
node core.js
# Open http://localhost:8899
# Optional: node setup.js  (downloads ~4GB AI model)
\`\`\`

## Requirements
- Node.js 18+
- ${platform.noModel ? '~4GB free disk space (for model)' : '~5GB free disk space'}
- 2GB+ RAM (4GB recommended)

## Features
- 🧠 ARC Cycle — Analyzes → Plans → Codes → Self-Reviews
- 💡 Idea Mode — Describe ideas, get questions, then working code
- 📱 Phone Ready — Full web UI on any browser
- 🔌 Fully Offline — Zero internet after setup
- 💾 Save Projects — Work persists across sessions

## Notes
${platform.notes}

## Support
- Issues: https://github.com/zowskyy/mia.loa/issues
- Free forever. MIT License.
`;
}

async function buildPlatform(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    console.error(`❌ Unknown platform: ${platformKey}`);
    return false;
  }

  const releaseName = `${NAME}-${VERSION}-${platformKey}`;
  const buildDir = join(RELEASE_DIR, 'build', releaseName);
  const outputFile = join(RELEASE_DIR, `${releaseName}.${platform.ext}`);

  console.log(`\n📦 Building: ${platform.label}`);
  console.log(`   Output: ${basename(outputFile)}`);

  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  for (const file of CORE_FILES) {
    const src = join(ROOT, file);
    const dest = join(buildDir, file);
    if (existsSync(src)) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
  }

  if (!platform.noModel) {
    const modelSrc = join(ROOT, 'models', 'model.gguf');
    const modelDest = join(buildDir, 'models', 'model.gguf');
    if (existsSync(modelSrc)) {
      console.log('   Including model...');
      mkdirSync(dirname(modelDest), { recursive: true });
      copyFileSync(modelSrc, modelDest);
    } else {
      console.log('   ⚠️  Model not found. Run: node setup.js');
    }
  }

  if (platform.ext === 'tar.gz') {
    const launcher = join(buildDir, 'lighthouse');
    if (existsSync(launcher)) chmodSync(launcher, 0o755);
  }

  writeFileSync(join(buildDir, 'RELEASE_NOTES.md'), generateReleaseNotes(platform, platformKey));

  console.log(`   Creating ${platform.ext}...`);
  await createArchive(buildDir, outputFile, platform.ext);

  const checksum = await generateChecksum(outputFile);
  writeFileSync(outputFile + '.sha256', checksum);

  rmSync(buildDir, { recursive: true });

  const sizeMB = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
  console.log(`   ✅ ${sizeMB} MB | SHA256: ${checksum.split(' ')[0].substring(0, 16)}...`);

  return true;
}

async function createAliasArchive(sourceKey, aliasKey) {
  const source = PLATFORMS[sourceKey];
  const alias = PLATFORMS[aliasKey];
  if (!source || !alias) return false;

  const srcFile = join(RELEASE_DIR, `${NAME}-${VERSION}-${sourceKey}.${source.ext}`);
  const destFile = join(RELEASE_DIR, `${NAME}-${VERSION}-${aliasKey}.${alias.ext}`);

  if (!existsSync(srcFile)) return false;

  console.log(`\n📋 Alias: ${alias.label} (from ${sourceKey})`);
  copyFileSync(srcFile, destFile);

  const checksum = await generateChecksum(destFile);
  writeFileSync(destFile + '.sha256', checksum);

  const sizeMB = (statSync(destFile).size / 1024 / 1024).toFixed(1);
  console.log(`   ✅ ${basename(destFile)} — ${sizeMB} MB (shared binary)`);
  return true;
}

async function createArchive(sourceDir, outputFile, format) {
  if (archiver) {
    const fs = require('fs');
    const output = fs.createWriteStream(outputFile);
    const archive = format === 'zip'
      ? archiver('zip', { zlib: { level: 9 } })
      : archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(sourceDir, basename(sourceDir));
      archive.finalize();
    });
  } else if (format === 'zip') {
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Compress-Archive -Path '${sourceDir}' -DestinationPath '${outputFile}' -Force"`,
        { stdio: 'pipe', shell: 'powershell' }
      );
    } else {
      execSync(`cd "${dirname(sourceDir)}" && zip -r "${outputFile}" "${basename(sourceDir)}"`,
        { stdio: 'pipe' });
    }
  } else {
    execSync(`cd "${dirname(sourceDir)}" && tar -czf "${outputFile}" "${basename(sourceDir)}"`,
      { stdio: 'pipe' });
  }
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

async function buildDockerImage() {
  console.log('\n🐳 Building Docker image...');
  const dockerDir = join(RELEASE_DIR, 'build', 'docker');
  if (existsSync(dockerDir)) rmSync(dockerDir, { recursive: true });
  mkdirSync(dockerDir, { recursive: true });

  for (const file of CORE_FILES) {
    const src = join(ROOT, file);
    if (existsSync(src)) {
      mkdirSync(join(dockerDir, dirname(file)), { recursive: true });
      copyFileSync(src, join(dockerDir, file));
    }
  }

  const dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 8899
ENV NODE_ENV=production
CMD ["node", "core.js"]
`;
  writeFileSync(join(dockerDir, 'Dockerfile'), dockerfile);

  try {
    execSync(`docker build -t lighthouse:${VERSION} "${dockerDir}"`, { stdio: 'inherit' });
    const tarFile = join(RELEASE_DIR, `lighthouse-${VERSION}-docker.tar`);
    execSync(`docker save -o "${tarFile}" lighthouse:${VERSION}`, { stdio: 'inherit' });
    console.log('   ✅ Docker image saved');
  } catch {
    console.log('   ⚠️  Docker unavailable. Dockerfile created for manual build.');
  }
  rmSync(dockerDir, { recursive: true });
}

async function buildRPiInstaller() {
  console.log('\n🍓 Building RPi installer...');
  const rpiDir = join(RELEASE_DIR, 'build', 'rpi');
  if (existsSync(rpiDir)) rmSync(rpiDir, { recursive: true });
  mkdirSync(rpiDir, { recursive: true });

  const installScript = `#!/bin/bash
set -e
echo "🍓 Lighthouse RPi Installer v${VERSION}"
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git curl
cd /home/pi
git clone https://github.com/zowskyy/mia.loa.git lighthouse || (cd lighthouse && git pull)
cd lighthouse && npm install --production && node setup.js
sudo tee /etc/systemd/system/lighthouse.service > /dev/null << 'SVC'
[Unit]
Description=Lighthouse AI Agent
After=network.target
[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/lighthouse
ExecStart=/usr/bin/node core.js
Restart=on-failure
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
SVC
sudo systemctl daemon-reload && sudo systemctl enable lighthouse && sudo systemctl start lighthouse
echo "✅ Ready! Open http://$(hostname -I | awk '{print $1}'):8899"
`;
  writeFileSync(join(rpiDir, 'install.sh'), installScript);
  chmodSync(join(rpiDir, 'install.sh'), 0o755);

  const tarFile = join(RELEASE_DIR, `lighthouse-${VERSION}-rpi-installer.tar.gz`);
  execSync(`cd "${RELEASE_DIR}/build" && tar -czf "${tarFile}" rpi/`, { stdio: 'pipe' });
  console.log('   ✅ RPi installer created');
  rmSync(rpiDir, { recursive: true });
}

function checkTools(platformKeys) {
  const neededFormats = new Set(platformKeys.map(k => PLATFORMS[k]?.ext));
  const missing = [];

  if (neededFormats.has('tar.gz')) {
    for (const tool of ['tar', 'gzip']) {
      try {
        execSync(process.platform === 'win32' ? `where ${tool}` : `command -v ${tool}`,
          { stdio: 'ignore' });
      } catch { missing.push(tool); }
    }
  }

  if (neededFormats.has('zip') && !archiver) {
    try {
      execSync(process.platform === 'win32' ? 'where zip' : 'command -v zip',
        { stdio: 'ignore' });
    } catch { missing.push('zip'); }
  }

  if (missing.length > 0) {
    console.log(`⚠️  Missing tools: ${missing.join(', ')}`);
    if (missing.includes('zip')) {
      console.log('   Install: sudo apt install zip   (or npm install archiver)');
    }
    return false;
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--platform') || args.includes('--platforms')) {
    console.log('\n📋 Available platforms:\n');
    for (const [key, p] of Object.entries(PLATFORMS)) {
      console.log(`  ${key.padEnd(20)} ${p.label}`);
      if (p.buildKey !== key) console.log(`                      ↳ Same binary as: ${p.buildKey}`);
    }
    console.log('\nUsage: node release.js [platform...]');
    console.log('       node release.js --all       Build all unique platforms');
    console.log('       node release.js --dry-run   Preview\n');
    return;
  }

  if (args.includes('--dry-run')) {
    console.log('\n🔍 DRY RUN\n');
    const unique = getUniqueBuilds(Object.keys(PLATFORMS));
    for (const [key, p] of Object.entries(PLATFORMS)) {
      const name = `${NAME}-${VERSION}-${key}.${p.ext}`;
      const dup = p.buildKey !== key ? ` (same binary as ${p.buildKey})` : '';
      const builds = unique.includes(key) ? ' [build]' : ' [alias copy]';
      console.log(`  📦 ${name.padEnd(48)} ${p.label}${dup}${builds}`);
    }
    console.log(`\n  Unique builds: ${unique.length}  |  Total labels: ${Object.keys(PLATFORMS).length}\n`);
    return;
  }

  if (!existsSync(RELEASE_DIR)) mkdirSync(RELEASE_DIR, { recursive: true });

  let platformsToBuild;
  const buildAll = args.length === 0 || args.includes('--all');
  if (buildAll) {
    platformsToBuild = getUniqueBuilds(Object.keys(PLATFORMS));
    console.log(`\n⚡ Building ${platformsToBuild.length} unique platforms (${Object.keys(PLATFORMS).length} total labels)\n`);
  } else {
    platformsToBuild = getUniqueBuilds(args.filter(a => !a.startsWith('--')));
  }

  console.log(`Lighthouse Release Builder v${VERSION}`);
  console.log('═'.repeat(50));

  checkTools(platformsToBuild);

  const built = [];
  const failed = [];
  const aliasKeys = [];

  for (const key of platformsToBuild) {
    const ok = await buildPlatform(key);
    if (ok) {
      built.push(key);
      for (const alias of getAliasPlatforms(key)) {
        if (buildAll || args.includes(alias)) {
          aliasKeys.push({ source: key, alias });
        }
      }
    } else {
      failed.push(key);
    }
  }

  for (const { source, alias } of aliasKeys) {
    const ok = await createAliasArchive(source, alias);
    if (ok) built.push(alias);
    else failed.push(alias);
  }

  if (args.includes('docker')) await buildDockerImage();
  if (args.includes('rpi')) await buildRPiInstaller();

  if (built.length > 0) {
    const manifest = {
      version: VERSION,
      buildId: BUILD_ID,
      date: new Date().toISOString(),
      platforms: {}
    };

    for (const key of [...new Set(built)]) {
      const p = PLATFORMS[key];
      const fn = `${NAME}-${VERSION}-${key}.${p.ext}`;
      const fp = join(RELEASE_DIR, fn);
      if (existsSync(fp)) {
        const st = statSync(fp);
        const shafile = fp + '.sha256';
        manifest.platforms[key] = {
          label: p.label,
          filename: fn,
          sizeMB: (st.size / 1024 / 1024).toFixed(1),
          buildKey: p.buildKey,
          aliasOf: p.buildKey !== key ? p.buildKey : null,
          sha256: existsSync(shafile) ? readFileSync(shafile, 'utf-8').split(' ')[0] : null
        };
      }
    }

    writeFileSync(join(RELEASE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

    for (const key of [...new Set(built)]) {
      const p = PLATFORMS[key];
      const fn = `${NAME}-${VERSION}-${key}.${p.ext}`;
      const latest = join(RELEASE_DIR, `${NAME}-latest-${key}.${p.ext}`);
      try { if (existsSync(latest)) rmSync(latest); } catch {}
      try {
        symlinkSync(fn, latest);
      } catch {
        copyFileSync(join(RELEASE_DIR, fn), latest);
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ ${built.length} built  ❌ ${failed.length} failed`);
  console.log(`📁 ${RELEASE_DIR}\n`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
