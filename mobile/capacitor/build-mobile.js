#!/usr/bin/env node
/*
  Builds Lighthouse as a native Android/iOS app using Capacitor.
  Requires: npm install (in mobile/capacitor first)

  Usage:
    node build-mobile.js
    node build-mobile.js --server http://192.168.1.10:8899
    node build-mobile.js --sync    # also run cap sync
*/

const { execSync } = require('child_process');
const { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..', '..');
const MOBILE_DIR = __dirname;
const WEB_DIR = join(MOBILE_DIR, 'www');

const args = process.argv.slice(2);
const serverIdx = args.indexOf('--server');
const serverUrl = serverIdx >= 0 ? args[serverIdx + 1] : 'http://localhost:8899';
const doSync = args.includes('--sync');

console.log('📱 Building Lighthouse Mobile App\n');

if (existsSync(WEB_DIR)) rmSync(WEB_DIR, { recursive: true });
mkdirSync(WEB_DIR, { recursive: true });

const files = [
  'index.html', 'client.js', 'mobile.js', 'mobile.css',
  'webllm.js', 'webllm-bridge.js',
  'sw.js', 'manifest.json', 'connect.html'
];

for (const file of files) {
  const src = join(ROOT, 'public', file);
  const dest = join(WEB_DIR, file);
  if (existsSync(src)) copyFileSync(src, dest);
}

let html = readFileSync(join(WEB_DIR, 'index.html'), 'utf-8');

const capacitorPlugins = `
  <script type="module">
    import { Capacitor } from '@capacitor/core';

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
            path: 'lighthouse/' + file.path,
            data: file.content,
            directory: Directory.Documents,
            recursive: true
          });
          if (typeof addMsg === 'function') {
            addMsg('✅ Saved to Documents/lighthouse/' + file.path, 'system');
          }
        } catch (err) {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.path.split('/').pop();
          a.click();
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
const config = {
  appId: 'org.lighthouse.coding.agent',
  appName: 'Lighthouse',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'http'
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

writeFileSync(join(MOBILE_DIR, 'capacitor.config.json'), JSON.stringify(config, null, 2));

console.log('✅ Mobile web assets built in mobile/capacitor/www/');
console.log(`   Server URL: ${serverUrl}`);
console.log('');
console.log('Next steps:');
console.log('  cd mobile/capacitor');
console.log('  npm install');
console.log('  npm run add:android   # or add:ios (first time only)');
console.log('  npm run android       # open Android Studio');
console.log('  npm run ios           # open Xcode');
console.log('');

if (doSync && existsSync(join(MOBILE_DIR, 'node_modules', '@capacitor', 'cli'))) {
  console.log('🔄 Running cap sync...');
  execSync('npx cap sync', { cwd: MOBILE_DIR, stdio: 'inherit' });
  console.log('✅ Cap sync complete');
}
