#!/usr/bin/env node
/*
  Mobile build script — works in CI and locally.
  Generates web assets for the Capacitor native wrapper.

  Usage:
    node build-mobile.js
    node build-mobile.js --server http://192.168.1.10:8899
    node build-mobile.js --sync
*/

const { execSync } = require('child_process');
const { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..', '..');
const MOBILE_DIR = __dirname;
const WEB_DIR = join(MOBILE_DIR, 'www');

const args = process.argv.slice(2);
const serverIdx = args.indexOf('--server');
const serverUrl = serverIdx >= 0 ? args[serverIdx + 1] : (process.env.LIGHTHOUSE_SERVER || 'http://localhost:8899');
const doSync = args.includes('--sync');

console.log('📱 Building Lighthouse mobile web assets...\n');

if (existsSync(WEB_DIR)) rmSync(WEB_DIR, { recursive: true });
mkdirSync(WEB_DIR, { recursive: true });

const publicFiles = [
  'index.html', 'client.js', 'mobile.js', 'mobile.css',
  'sw.js', 'manifest.json', 'connect.html',
  'webllm.js', 'webllm-bridge.js', 'frontier-parser.js'
];

for (const file of publicFiles) {
  const src = join(ROOT, 'public', file);
  const dest = join(WEB_DIR, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ⚠️  Missing: ${file}`);
  }
}

let html = readFileSync(join(WEB_DIR, 'index.html'), 'utf-8');

const capacitorPlugins = `
  <script type="module">
    try {
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const { Clipboard } = await import('@capacitor/clipboard');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { SplashScreen } = await import('@capacitor/splash-screen');

        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0a0a1a' });
          await SplashScreen.hide();
        } catch {}

        window.downloadFile = async function(file) {
          try {
            await Filesystem.writeFile({
              path: 'Lighthouse/' + file.path,
              data: file.content,
              directory: Directory.Documents,
              recursive: true
            });
            if (typeof addMsg === 'function') {
              addMsg('✅ Saved to Documents/Lighthouse/' + file.path, 'system');
            }
          } catch {
            const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.path.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        };

        window.nativeShare = async function(file) {
          try {
            await Share.share({
              title: file.path,
              text: file.content.substring(0, 500),
              dialogTitle: 'Share code'
            });
          } catch {}
        };

        window.nativeCopy = async function(text) {
          try { await Clipboard.write({ string: text }); } catch {}
        };

        document.body.classList.add('capacitor-native');
      }
    } catch (e) {
      console.log('Capacitor plugins not available — using browser fallbacks');
    }
  </script>
`;

if (!html.includes('capacitor-native')) {
  html = html.replace('</head>', capacitorPlugins + '\n</head>');
}

if (!html.includes('manifest.json')) {
  html = html.replace('</head>', '  <link rel="manifest" href="/manifest.json">\n</head>');
}

writeFileSync(join(WEB_DIR, 'index.html'), html);

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
const configPath = join(MOBILE_DIR, 'capacitor.config.json');
const config = {
  appId: 'foundation.lighthouse.coding.agent',
  appName: 'Lighthouse',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a1a'
    }
  }
};

writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('\n✅ Mobile assets built in mobile/capacitor/www/');
console.log(`   Server URL: ${serverUrl}`);
console.log('   Next: npx cap sync android   (or ios)');
console.log('   Then: npx cap open android    (or ios)\n');

if (doSync && existsSync(join(MOBILE_DIR, 'node_modules', '@capacitor', 'cli'))) {
  console.log('🔄 Running cap sync...');
  execSync('npx cap sync', { cwd: MOBILE_DIR, stdio: 'inherit' });
  console.log('✅ Cap sync complete');
}
