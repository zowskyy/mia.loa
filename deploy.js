#!/usr/bin/env node
/*
  LIGHTHOUSE FIELD DEPLOYMENT SYSTEM v1.0.1

  Commands:
    node deploy.js kit [region]        Build Community Kit
    node deploy.js docs [region]       Generate offline documentation
    node deploy.js translate [region]  Generate localized UI files
    node deploy.js train [region]      Build Navigator training materials
    node deploy.js partner [region]    Partnership outreach package
    node deploy.js impact [region]     Impact tracking setup
    node deploy.js all [region]        Run all deployment preparations
    node deploy.js ship <region>       Package for specific region
    node deploy.js test [region]       Verify deployment readiness
*/

const {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  copyFileSync, rmSync, chmodSync, readdirSync, statSync
} = require('fs');
const { join, basename, dirname, resolve } = require('path');

const ROOT = resolve(__dirname);
const DEPLOY_DIR = join(ROOT, 'deploy');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;

const REGIONS = {
  'east-africa': {
    name: 'East Africa',
    languages: ['sw', 'en', 'fr'],
    exampleCurrency: 'KES',
    solarNote: '5-6 kWh/m²/day — excellent for solar deployment',
    connectivity: '3G coverage ~70%. Offline-first design essential.',
    localPartners: 'iHub (Nairobi), Kinu (Tanzania), Hive Colab (Uganda), kLab (Rwanda)',
    greeting: { sw: 'Habari', en: 'Hello', fr: 'Bonjour' }
  },
  'south-asia': {
    name: 'South Asia',
    languages: ['hi', 'bn', 'en'],
    exampleCurrency: 'INR',
    solarNote: '4-5 kWh/m²/day — good solar potential',
    connectivity: '4G growing in urban areas. Rural areas need offline.',
    localPartners: 'Digital Empowerment Foundation (India), Grameenphone (Bangladesh)',
    greeting: { hi: 'नमस्ते', bn: 'নমস্কার', en: 'Hello' }
  },
  'southeast-asia': {
    name: 'Southeast Asia',
    languages: ['id', 'en'],
    exampleCurrency: 'IDR',
    solarNote: '4-5 kWh/m²/day — island microgrids recommended',
    connectivity: 'Island geography makes offline essential for reliability.',
    localPartners: 'Kibar Foundation (Indonesia), Ideaspace (Philippines)',
    greeting: { id: 'Halo', en: 'Hello' }
  },
  'latin-america': {
    name: 'Latin America',
    languages: ['es', 'pt', 'en'],
    exampleCurrency: 'BRL',
    solarNote: '5-7 kWh/m²/day — among the best solar potential globally',
    connectivity: 'Urban 4G widespread. Rural and mountain areas need offline.',
    localPartners: 'Laboratoria, Platzi, CDI Latin America',
    greeting: { es: '¡Hola!', pt: 'Olá!', en: 'Hello' }
  },
  'west-africa': {
    name: 'West Africa',
    languages: ['fr', 'en', 'ha'],
    exampleCurrency: 'NGN',
    solarNote: '5-6 kWh/m²/day — excellent solar conditions',
    connectivity: 'Mobile-first region. Offline critical outside capital cities.',
    localPartners: 'CcHUB (Nigeria), iSpace (Ghana), Jokkolabs (Senegal)',
    greeting: { fr: 'Bonjour', en: 'Hello', ha: 'Sannu' }
  },
  'global': {
    name: 'Global',
    languages: ['en', 'sw', 'hi', 'bn', 'es', 'pt', 'fr', 'id', 'ha'],
    exampleCurrency: 'USD',
    solarNote: 'Varies by region. Solar kit specs included for all latitudes.',
    connectivity: 'Universal offline support. Works with or without internet.',
    localPartners: 'Global distribution network',
    greeting: { en: 'Hello' }
  }
};

const GUIDE_TITLES = {
  en: 'Quick Start Guide', sw: 'Mwongozo wa Haraka', hi: 'त्वरित शुरुआत गाइड',
  bn: 'দ্রুত শুরু গাইড', es: 'Guía Rápida', fr: 'Guide Rapide',
  pt: 'Guia Rápido', id: 'Panduan Cepat', ha: 'Jagoran Sauri'
};

const HELP_TITLES = {
  en: 'Help', sw: 'Msaada', hi: 'मदद', bn: 'সহায়তা', es: 'Ayuda',
  fr: 'Aide', pt: 'Ajuda', id: 'Bantuan', ha: 'Taimako'
};

const LEARN_TITLES = {
  en: 'Learn', sw: 'Jifunze', hi: 'सीखें', bn: 'শিখুন', es: 'Aprender',
  fr: 'Apprendre', pt: 'Aprender', id: 'Belajar', ha: 'Koyi'
};

const LANG_NAMES = {
  en: 'English', sw: 'Swahili', hi: 'Hindi', bn: 'Bengali', es: 'Spanish',
  pt: 'Portuguese', fr: 'French', id: 'Indonesian', ha: 'Hausa'
};

const STRINGS = {
  en: {
    welcome: 'I build software from ideas. Free. Offline. No subscription.',
    placeholder: 'Describe what you want to build...',
    send: 'Send', ideaButton: '💡 I have an idea', download: 'Download',
    saveProject: 'Save Project', analyzing: 'Analyzing your request...',
    planning: 'Creating a plan...', coding: 'Generating code...',
    reviewing: 'Reviewing and refining...', complete: 'Complete!',
    offline: 'Offline (cached)', learningMode: 'Learning mode',
    serverOffline: 'Server offline', modelReady: 'AI model ready',
    error: 'Something went wrong', retry: 'Try again'
  },
  sw: {
    welcome: 'Ninajenga programu kutoka kwa mawazo. Bure. Bila mtandao. Hakuna malipo.',
    placeholder: 'Eleza unachotaka kujenga...', send: 'Tuma',
    ideaButton: '💡 Nina wazo', download: 'Pakua', saveProject: 'Hifadhi Mradi',
    analyzing: 'Kuchambua ombi lako...', planning: 'Kupanga...',
    coding: 'Kutengeneza msimbo...', reviewing: 'Kukagua na kurekebisha...',
    complete: 'Imekamilika!', offline: 'Hali ya nje ya mtandao',
    learningMode: 'Hali ya kujifunza', serverOffline: 'Seva haipo',
    modelReady: 'Mfano wa AI uko tayari', error: 'Hitilafu imetokea', retry: 'Jaribu tena'
  },
  hi: {
    welcome: 'मैं विचारों से सॉफ्टवेयर बनाता हूं। मुफ्त। ऑफलाइन। कोई सदस्यता नहीं।',
    placeholder: 'बताएं कि आप क्या बनाना चाहते हैं...', send: 'भेजें',
    ideaButton: '💡 मेरे पास एक विचार है', download: 'डाउनलोड करें',
    saveProject: 'प्रोजेक्ट सहेजें', analyzing: 'आपके अनुरोध का विश्लेषण...',
    planning: 'योजना बना रहे हैं...', coding: 'कोड बना रहे हैं...',
    reviewing: 'समीक्षा और सुधार...', complete: 'पूरा हुआ!',
    offline: 'ऑफलाइन (कैश किया गया)', learningMode: 'सीखने का तरीका',
    serverOffline: 'सर्वर ऑफलाइन', modelReady: 'AI मॉडल तैयार',
    error: 'कुछ गलत हुआ', retry: 'पुनः प्रयास करें'
  },
  bn: {
    welcome: 'আমি ধারণা থেকে সফটওয়্যার তৈরি করি। বিনামূল্যে। অফলাইন। কোনো সাবস্ক্রিপশন নেই।',
    placeholder: 'আপনি কী তৈরি করতে চান তা বর্ণনা করুন...', send: 'পাঠান',
    ideaButton: '💡 আমার একটি ধারণা আছে', download: 'ডাউনলোড',
    saveProject: 'প্রকল্প সংরক্ষণ', analyzing: 'আপনার অনুরোধ বিশ্লেষণ...',
    planning: 'পরিকল্পনা তৈরি...', coding: 'কোড তৈরি...',
    reviewing: 'পর্যালোচনা ও সংশোধন...', complete: 'সম্পন্ন!',
    offline: 'অফলাইন (ক্যাশ)', learningMode: 'শেখার মোড',
    serverOffline: 'সার্ভার অফলাইন', modelReady: 'AI মডেল প্রস্তুত',
    error: 'কিছু ভুল হয়েছে', retry: 'আবার চেষ্টা করুন'
  },
  es: {
    welcome: 'Construyo software a partir de ideas. Gratis. Sin conexión. Sin suscripción.',
    placeholder: 'Describe lo que quieres construir...', send: 'Enviar',
    ideaButton: '💡 Tengo una idea', download: 'Descargar',
    saveProject: 'Guardar proyecto', analyzing: 'Analizando tu solicitud...',
    planning: 'Creando un plan...', coding: 'Generando código...',
    reviewing: 'Revisando y mejorando...', complete: '¡Completo!',
    offline: 'Sin conexión (en caché)', learningMode: 'Modo aprendizaje',
    serverOffline: 'Servidor desconectado', modelReady: 'Modelo de IA listo',
    error: 'Algo salió mal', retry: 'Intentar de nuevo'
  },
  fr: {
    welcome: 'Je construis des logiciels à partir d\'idées. Gratuit. Hors ligne. Sans abonnement.',
    placeholder: 'Décrivez ce que vous voulez construire...', send: 'Envoyer',
    ideaButton: '💡 J\'ai une idée', download: 'Télécharger',
    saveProject: 'Sauvegarder le projet', analyzing: 'Analyse de votre demande...',
    planning: 'Création d\'un plan...', coding: 'Génération du code...',
    reviewing: 'Révision et amélioration...', complete: 'Terminé !',
    offline: 'Hors ligne (en cache)', learningMode: 'Mode apprentissage',
    serverOffline: 'Serveur hors ligne', modelReady: 'Modèle IA prêt',
    error: 'Quelque chose s\'est mal passé', retry: 'Réessayer'
  },
  pt: {
    welcome: 'Eu construo software a partir de ideias. Grátis. Offline. Sem assinatura.',
    placeholder: 'Descreva o que você quer construir...', send: 'Enviar',
    ideaButton: '💡 Tenho uma ideia', download: 'Baixar',
    saveProject: 'Salvar projeto', analyzing: 'Analisando sua solicitação...',
    planning: 'Criando um plano...', coding: 'Gerando código...',
    reviewing: 'Revisando e melhorando...', complete: 'Completo!',
    offline: 'Offline (em cache)', learningMode: 'Modo de aprendizado',
    serverOffline: 'Servidor offline', modelReady: 'Modelo de IA pronto',
    error: 'Algo deu errado', retry: 'Tentar novamente'
  },
  id: {
    welcome: 'Saya membangun perangkat lunak dari ide. Gratis. Offline. Tanpa langganan.',
    placeholder: 'Jelaskan apa yang ingin Anda buat...', send: 'Kirim',
    ideaButton: '💡 Saya punya ide', download: 'Unduh',
    saveProject: 'Simpan Proyek', analyzing: 'Menganalisis permintaan...',
    planning: 'Membuat rencana...', coding: 'Membuat kode...',
    reviewing: 'Meninjau dan memperbaiki...', complete: 'Selesai!',
    offline: 'Offline (cache)', learningMode: 'Mode belajar',
    serverOffline: 'Server offline', modelReady: 'Model AI siap',
    error: 'Terjadi kesalahan', retry: 'Coba lagi'
  },
  ha: {
    welcome: 'Ina gina software daga ra\'ayoyi. Kyauta. Ba tare da intanet. Babu biyan kuɗi.',
    placeholder: 'Bayyana abin da kake son gina...', send: 'Aika',
    ideaButton: '💡 Ina da ra\'ayi', download: 'Zazzagewa',
    saveProject: 'Ajiye Aiki', analyzing: 'Ana nazarin buƙatarka...',
    planning: 'Ana tsara shiri...', coding: 'Ana samar da lamba...',
    reviewing: 'Ana bita da gyara...', complete: 'An gama!',
    offline: 'Ba tare da intanet (an adana)', learningMode: 'Yanayin koyo',
    serverOffline: 'Sabar ba ta aiki', modelReady: 'Samfurin AI ya shirya',
    error: 'Wani abu ya faru', retry: 'Sake gwadawa'
  }
};

function validateRegion(regionKey) {
  if (!REGIONS[regionKey]) {
    throw new Error(`Unknown region: ${regionKey}. Available: ${Object.keys(REGIONS).join(', ')}`);
  }
  return REGIONS[regionKey];
}

function step(msg) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${'═'.repeat(60)}`);
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }

const KIT_CORE_FILES = [
  'core.js', 'setup.js', 'package.json', 'README.md',
  'public/index.html', 'public/client.js', 'public/mobile.js',
  'public/mobile.css', 'public/sw.js', 'public/manifest.json',
  'public/webllm.js', 'public/webllm-bridge.js', 'public/connect.html',
  'lighthouse', 'release.js'
];

async function buildKit(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Community Kit — ${region.name}`);

  const kitDir = join(DEPLOY_DIR, 'kits', regionKey);
  if (existsSync(kitDir)) rmSync(kitDir, { recursive: true });

  ['boot', 'root/lighthouse', 'root/docs', 'root/models'].forEach(d =>
    mkdirSync(join(kitDir, d), { recursive: true })
  );

  KIT_CORE_FILES.forEach(f => {
    const src = join(ROOT, f);
    const dest = join(kitDir, 'root/lighthouse', f);
    if (existsSync(src)) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
  });
  ok('Core files copied');

  const modelFile = join(ROOT, 'models', 'model.gguf');
  if (existsSync(modelFile)) {
    copyFileSync(modelFile, join(kitDir, 'root/lighthouse/models/model.gguf'));
    ok('AI model included');
  } else {
    warn('No model found — run "node setup.js" first to include it');
  }

  writeFileSync(join(kitDir, 'boot/lighthouse.service'), `[Unit]
Description=Lighthouse AI Coding Agent
After=network.target
[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/lighthouse
ExecStart=/usr/bin/node /home/pi/lighthouse/core.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8899
[Install]
WantedBy=multi-user.target
`);

  const firstBootScript = `#!/bin/bash
# Lighthouse Community Kit — First Boot Setup
echo "⚡ Setting up Lighthouse..."
sleep 5
if [ -f /boot/lighthouse.service ]; then
  sudo cp /boot/lighthouse.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable lighthouse
  sudo systemctl start lighthouse
fi
echo "✅ Lighthouse should be running at http://$(hostname -I | awk '{print $1}'):8899"
`;
  writeFileSync(join(kitDir, 'boot/firstboot.sh'), firstBootScript);
  chmodSync(join(kitDir, 'boot/firstboot.sh'), 0o755);
  ok('Auto-start service configured');

  region.languages.forEach(lang => {
    const strings = STRINGS[lang] || STRINGS.en;
    const guide = `# Lighthouse — ${GUIDE_TITLES[lang] || GUIDE_TITLES.en}

## 📡 Connect
Open WiFi settings on your phone.
Connect to network: **lighthouse-setup**
Password: **build4all**

## 🌐 Open Lighthouse
Open your browser and go to:
**http://lighthouse.local:8899**

## 💡 Build Your First App
1. Tap "${strings.ideaButton}"
2. Describe your idea in ${LANG_NAMES[lang] || lang}
3. Lighthouse will build it for you

## 📱 Save to Phone
Tap "${strings.download}" to save your app.
Share it with friends and family!

## 🆘 Need Help?
Look for a Lighthouse Navigator in your community.
Or visit: lighthouse.foundation/help

---
${strings.welcome}
`;
    writeFileSync(join(kitDir, `root/docs/quickstart-${lang}.md`), guide);
  });
  ok(`Quick-start guides in: ${region.languages.join(', ')}`);

  writeFileSync(join(kitDir, 'root/docs/README.md'), `# Lighthouse Community Kit — ${region.name}

## What's in this kit
- Raspberry Pi with Lighthouse pre-installed
- AI model (offline — no internet needed)
- Solar panel + battery (optional, sold separately)
- Printed quick-start guide

## First Time Setup
1. Connect Raspberry Pi to power (solar or wall)
2. Wait 1-2 minutes for it to boot
3. Connect your phone to WiFi: lighthouse-setup
4. Open browser: http://lighthouse.local:8899

## Solar Information
${region.solarNote}

## Internet
${region.connectivity}

## Local Partners
${region.localPartners}

## Languages
${region.languages.map(l => LANG_NAMES[l] || l).join(', ')}

## Support
lighthouse.foundation/help
`);

  writeFileSync(join(kitDir, 'manifest.json'), JSON.stringify({
    version: VERSION,
    region: regionKey,
    regionName: region.name,
    buildDate: new Date().toISOString(),
    languages: region.languages,
    hasModel: existsSync(join(kitDir, 'root/lighthouse/models/model.gguf'))
  }, null, 2));

  console.log(`\n  📦 Kit location: ${kitDir}`);
  console.log('  To flash: Copy contents to SD card and insert into Raspberry Pi.');
  return true;
}

async function buildDocs(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Documentation — ${region.name}`);

  const docsDir = join(DEPLOY_DIR, 'docs', regionKey);
  if (existsSync(docsDir)) rmSync(docsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  for (const lang of region.languages) {
    const langDir = join(docsDir, lang);
    mkdirSync(langDir, { recursive: true });
    const strings = STRINGS[lang] || STRINGS.en;

    writeFileSync(join(langDir, 'index.html'), `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lighthouse — ${HELP_TITLES[lang] || HELP_TITLES.en}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #e94560; }
    .card { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
    a { color: #e94560; text-decoration: none; }
  </style>
</head>
<body>
  <h1>⚡ Lighthouse</h1>
  <p>${strings.welcome}</p>
  <div class="card">
    <h3>🚀 ${strings.ideaButton}</h3>
    <p>${strings.placeholder}</p>
    <a href="quickstart.html">${strings.send} →</a>
  </div>
  <div class="card">
    <h3>📚 ${LEARN_TITLES[lang] || LEARN_TITLES.en}</h3>
    <p>Step-by-step guides in ${LANG_NAMES[lang] || lang}</p>
  </div>
  <div class="card">
    <h3>🆘 ${HELP_TITLES[lang] || HELP_TITLES.en}</h3>
    <p>Common problems and solutions</p>
  </div>
</body>
</html>`);
  }

  const commonDir = join(docsDir, 'assets');
  mkdirSync(commonDir, { recursive: true });
  ['welcome.png', 'idea.png', 'code.png'].forEach(name => {
    writeFileSync(join(commonDir, name + '.txt'),
      `[Screenshot placeholder: ${name}]\nReplace with actual screenshot for production.`);
  });

  ok(`Documentation built in ${region.languages.length} languages`);
  console.log(`  📁 ${docsDir}`);
  return true;
}

async function buildTranslations(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Translations — ${region.name}`);

  const i18nDir = join(DEPLOY_DIR, 'i18n');
  const publicI18n = join(ROOT, 'public', 'i18n.js');
  if (existsSync(i18nDir)) rmSync(i18nDir, { recursive: true });
  mkdirSync(i18nDir, { recursive: true });

  const filtered = {};
  region.languages.forEach(lang => {
    if (STRINGS[lang]) filtered[lang] = STRINGS[lang];
  });
  if (!filtered.en) filtered.en = STRINGS.en;

  const i18nJS = `// Auto-generated by deploy.js — ${new Date().toISOString()}
const LIGHTHOUSE_STRINGS = ${JSON.stringify(filtered, null, 2)};

function getLang() {
  return (navigator.language || 'en').split('-')[0];
}

function t(key) {
  const lang = getLang();
  return (LIGHTHOUSE_STRINGS[lang] && LIGHTHOUSE_STRINGS[lang][key])
    || LIGHTHOUSE_STRINGS.en[key]
    || key;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (!text) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = text;
    else el.textContent = text;
  });
});

window.LIGHTHOUSE_STRINGS = LIGHTHOUSE_STRINGS;
window.t = t;
window.getLang = getLang;
`;

  writeFileSync(join(i18nDir, 'i18n.js'), i18nJS);
  writeFileSync(publicI18n, i18nJS);

  region.languages.forEach(lang => {
    if (STRINGS[lang]) {
      writeFileSync(join(i18nDir, `${lang}.json`), JSON.stringify(STRINGS[lang], null, 2));
    }
  });

  ok(`Translations built for: ${region.languages.join(', ')}`);
  console.log(`  📁 ${i18nDir}`);
  console.log(`  📁 ${publicI18n} (copied to public/)`);
  return true;
}

async function buildTraining(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Navigator Training — ${region.name}`);

  const trainDir = join(DEPLOY_DIR, 'training', regionKey);
  if (existsSync(trainDir)) rmSync(trainDir, { recursive: true });
  mkdirSync(trainDir, { recursive: true });

  const modules = [
    { id: 1, title: { en: 'Welcome to Lighthouse', sw: 'Karibu kwenye Lighthouse', hi: 'लाइटहाउस में आपका स्वागत है', es: 'Bienvenido a Lighthouse', fr: 'Bienvenue à Lighthouse', pt: 'Bem-vindo ao Lighthouse' }, duration: '2 hours', topics: ['What is Lighthouse', 'How it works', 'Who it helps', 'Your role as Navigator'] },
    { id: 2, title: { en: 'Your First App', sw: 'App Yako ya Kwanza', hi: 'आपका पहला ऐप', es: 'Tu Primera App', fr: 'Votre Première App', pt: 'Seu Primeiro App' }, duration: '3 hours', topics: ['Starting Lighthouse', 'Using Idea Mode', 'Reading generated code', 'Testing the app', 'Saving and sharing'] },
    { id: 3, title: { en: 'Common Solutions', sw: 'Suluhisho za Kawaida', hi: 'सामान्य समाधान', es: 'Soluciones Comunes', fr: 'Solutions Courantes', pt: 'Soluções Comuns' }, duration: '4 hours', topics: ['Inventory tracker', 'Customer database', 'Scheduling tool', 'Payment logger', 'Health records'] },
    { id: 4, title: { en: 'Deploying to Phones', sw: 'Kusambaza kwenye Simu', hi: 'फोन पर तैनाती', es: 'Desplegar en Teléfonos', fr: 'Déploiement sur Téléphones', pt: 'Implantando em Telefones' }, duration: '2 hours', topics: ['WiFi hotspot setup', 'QR code sharing', 'PWA installation', 'Offline access'] },
    { id: 5, title: { en: 'Troubleshooting', sw: 'Utatuzi wa Matatizo', hi: 'समस्या निवारण', es: 'Solución de Problemas', fr: 'Dépannage', pt: 'Solução de Problemas' }, duration: '2 hours', topics: ['Server won\'t start', 'Model not found', 'Phone can\'t connect', 'App doesn\'t work', 'When to escalate'] },
    { id: 6, title: { en: 'Building Your Business', sw: 'Kujenga Biashara Yako', hi: 'अपना व्यवसाय बनाना', es: 'Construyendo tu Negocio', fr: 'Développer Votre Entreprise', pt: 'Construindo Seu Negócio' }, duration: '3 hours', topics: ['Pricing your services', 'Finding clients', 'Managing projects', 'Growing your reputation', 'Training other Navigators'] }
  ];

  region.languages.forEach(lang => {
    const langDir = join(trainDir, lang);
    mkdirSync(langDir, { recursive: true });

    let curriculum = `# Lighthouse Navigator Training — ${region.name}\n\n`;
    curriculum += `## Certification Tracks\n\n`;
    curriculum += `- 🥉 **Bronze Navigator** — Modules 1-2 (1 day)\n`;
    curriculum += `- 🥈 **Silver Navigator** — Modules 1-4 (2 days)\n`;
    curriculum += `- 🥇 **Gold Navigator** — All modules (3 days)\n\n---\n\n`;

    modules.forEach(m => {
      curriculum += `## Module ${m.id}: ${m.title[lang] || m.title.en}\n`;
      curriculum += `**Duration:** ${m.duration}\n\n**Topics:**\n`;
      m.topics.forEach(t => { curriculum += `- ${t}\n`; });
      curriculum += `\n---\n\n`;
    });

    curriculum += `## Navigator Certification Checklist\n\n`;
    curriculum += `### 🥉 Bronze Navigator\n- [ ] Can start Lighthouse and open web UI\n- [ ] Can help someone use Idea Mode\n- [ ] Has built 3 practice apps\n\n`;
    curriculum += `### 🥈 Silver Navigator\n- [ ] All Bronze requirements\n- [ ] Can deploy Lighthouse hub serving 20+ people\n- [ ] Has built 10 community apps\n- [ ] Can troubleshoot common problems\n\n`;
    curriculum += `### 🥇 Gold Navigator\n- [ ] All Silver requirements\n- [ ] Has trained 3 Bronze Navigators\n- [ ] Manages a regional hub\n- [ ] Contributes improvements back to Lighthouse\n`;

    writeFileSync(join(langDir, 'curriculum.md'), curriculum);
  });

  ok(`Training materials in ${region.languages.length} languages`);
  console.log(`  📁 ${trainDir}`);
  return true;
}

async function buildPartnerPackage(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Partnership Package — ${region.name}`);

  const partnerDir = join(DEPLOY_DIR, 'partners', regionKey);
  if (existsSync(partnerDir)) rmSync(partnerDir, { recursive: true });
  mkdirSync(partnerDir, { recursive: true });

  writeFileSync(join(partnerDir, 'one-pager.md'), `# Lighthouse — Free AI Coding for Every Community

## The Problem
AI tools that could help communities build software cost $20+/month
and require internet. 3 billion people are priced out.

## Our Solution
Lighthouse is a **free, offline AI coding agent** that runs on $35
computers and old phones. People describe their idea in their own
language, and Lighthouse builds working software.

## Region: ${region.name}
- ${region.connectivity}
- ${region.solarNote}
- Local partners: ${region.localPartners}

## Contact
- GitHub: github.com/zowskyy/mia.loa

---
*Lighthouse is MIT licensed. Free forever. No exceptions.*
`);

  writeFileSync(join(partnerDir, 'email-template.md'), `Subject: Lighthouse — Free AI coding tool for ${region.name}

Hi [Name],

I've built **Lighthouse** — a free, offline AI coding agent for ${region.name}.
Languages: ${region.languages.map(l => LANG_NAMES[l]).join(', ')}.

Happy to demo, send a kit, or customize for your use case.

Best,
[Your name]
`);

  writeFileSync(join(partnerDir, 'grant-abstract.md'), `PROJECT: Lighthouse — Democratizing AI Coding Tools

REGION: ${region.name}
BUDGET: $250,000 Year 1 — 500 Community Kits, 100 Navigators trained
METRICS: 5,000 people served, 500 community apps built
`);

  ok('Partnership package ready');
  console.log(`  📁 ${partnerDir}`);
  return true;
}

async function buildImpactTracking(regionKey = 'global') {
  const region = validateRegion(regionKey);
  step(`Building Impact Tracking — ${region.name}`);

  const impactDir = join(DEPLOY_DIR, 'impact', regionKey);
  const publicImpact = join(ROOT, 'public', 'impact');
  if (existsSync(impactDir)) rmSync(impactDir, { recursive: true });
  mkdirSync(impactDir, { recursive: true });
  mkdirSync(publicImpact, { recursive: true });

  writeFileSync(join(impactDir, 'README.md'), `# Impact Tracking — ${region.name}

Impact API is built into core.js at /api/impact.

- Dashboard: /impact/dashboard.html
- Record form: /impact/record.html
`);

  const dashboard = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lighthouse Impact — ${region.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #0a0a1a; color: #e0e0f0; }
    h1 { color: #e94560; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .metric { background: #12122a; padding: 20px; border-radius: 12px; text-align: center; }
    .metric .value { font-size: 36px; font-weight: bold; color: #4ecca3; }
    .metric .label { font-size: 12px; color: #8888aa; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #2a2a4a; }
    th { color: #8888aa; font-size: 12px; }
    a { color: #e94560; }
  </style>
</head>
<body>
  <h1>⚡ Lighthouse Impact — ${region.name}</h1>
  <p><a href="record.html">+ Record impact</a></p>
  <div class="metrics" id="metrics">Loading...</div>
  <h2>Recent Activity</h2>
  <table><thead><tr><th>Time</th><th>Type</th><th>Community</th><th>Navigator</th></tr></thead>
  <tbody id="recent"></tbody></table>
  <script>
    fetch('/api/impact').then(r => r.json()).then(d => {
      document.getElementById('metrics').innerHTML =
        '<div class="metric"><div class="value">' + d.total + '</div><div class="label">Total Actions</div></div>' +
        Object.entries(d.totals || {}).map(([k,v]) =>
          '<div class="metric"><div class="value">' + v + '</div><div class="label">' + k.replace(/_/g,' ') + '</div></div>'
        ).join('');
      document.getElementById('recent').innerHTML = (d.recentEntries || []).slice().reverse().slice(0, 20).map(e =>
        '<tr><td>' + new Date(e.timestamp).toLocaleString() + '</td><td>' + e.type + '</td><td>' + (e.community||'') + '</td><td>' + (e.navigator||'') + '</td></tr>'
      ).join('');
    });
  </script>
</body>
</html>`;

  const record = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Record Impact — Lighthouse</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #e0e0f0; }
    select, input { width: 100%; padding: 10px; margin: 8px 0; border-radius: 8px; border: 1px solid #2a2a4a; background: #12122a; color: #e0e0f0; font-size: 16px; }
    button { width: 100%; padding: 12px; background: #e94560; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
    .success { background: #4ecca3; color: #0a0a1a; padding: 10px; border-radius: 8px; text-align: center; margin-top: 10px; display: none; }
    a { color: #e94560; }
  </style>
</head>
<body>
  <h1>📊 Record Impact</h1>
  <p><a href="dashboard.html">← Dashboard</a></p>
  <form id="impactForm">
    <select id="type">
      <option value="app_built">App Built</option>
      <option value="person_trained">Person Trained</option>
      <option value="community_served">Community Served</option>
      <option value="kit_deployed">Kit Deployed</option>
    </select>
    <input id="description" placeholder="What happened? (brief)">
    <input id="navigator" placeholder="Your name">
    <input id="community" placeholder="Community name">
    <button type="submit">Record</button>
  </form>
  <div class="success" id="success">✅ Impact recorded!</div>
  <script>
    document.getElementById('impactForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await fetch('/api/impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: document.getElementById('type').value,
          description: document.getElementById('description').value,
          navigator: document.getElementById('navigator').value,
          community: document.getElementById('community').value,
          language: window.navigator.language.split('-')[0],
          region: '${regionKey}'
        })
      });
      document.getElementById('success').style.display = 'block';
      setTimeout(() => document.getElementById('success').style.display = 'none', 3000);
      e.target.reset();
    });
  </script>
</body>
</html>`;

  writeFileSync(join(impactDir, 'dashboard.html'), dashboard);
  writeFileSync(join(impactDir, 'record.html'), record);
  copyFileSync(join(impactDir, 'dashboard.html'), join(publicImpact, 'dashboard.html'));
  copyFileSync(join(impactDir, 'record.html'), join(publicImpact, 'record.html'));

  ok('Impact tracking system ready (API in core.js, UI in public/impact/)');
  console.log(`  📁 ${impactDir}`);
  return true;
}

async function buildAll(regionKey = 'global') {
  const region = validateRegion(regionKey);
  console.log(`\n⚡ Lighthouse Field Deployment — v${VERSION}`);
  console.log(`Region: ${region.name}`);
  console.log(`Output: ${DEPLOY_DIR}\n`);

  if (!existsSync(DEPLOY_DIR)) mkdirSync(DEPLOY_DIR, { recursive: true });

  const results = {
    kit: await buildKit(regionKey),
    docs: await buildDocs(regionKey),
    translations: await buildTranslations(regionKey),
    training: await buildTraining(regionKey),
    partners: await buildPartnerPackage(regionKey),
    impact: await buildImpactTracking(regionKey)
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  ✅ ALL DEPLOYMENT PACKAGES BUILT');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  📁 ${DEPLOY_DIR}`);
  console.log(`     ├── kits/${regionKey}/        Community Kit`);
  console.log(`     ├── docs/${regionKey}/         Offline documentation`);
  console.log(`     ├── i18n/                     UI translations`);
  console.log(`     ├── training/${regionKey}/     Navigator curriculum`);
  console.log(`     ├── partners/${regionKey}/     Outreach materials`);
  console.log(`     └── impact/${regionKey}/       Tracking dashboard`);
  console.log(`\n  🚀 Next: node deploy.js test ${regionKey}\n`);

  return results;
}

async function testDeployment(regionKey = 'global') {
  validateRegion(regionKey);
  console.log(`\n🧪 Testing deployment for ${regionKey}...\n`);

  const checks = [];
  const requiredFiles = [
    'core.js', 'package.json', 'public/index.html', 'public/client.js',
    'public/mobile.js', 'public/sw.js', 'public/manifest.json', 'deploy.js'
  ];

  requiredFiles.forEach(f => {
    const pass = existsSync(join(ROOT, f));
    checks.push({ name: `Source: ${f}`, pass });
    console.log(`  ${pass ? '✅' : '❌'} ${f}`);
  });

  const requiredKeys = ['welcome', 'placeholder', 'send', 'ideaButton', 'download', 'saveProject'];
  const languages = REGIONS[regionKey].languages;

  languages.forEach(lang => {
    if (!STRINGS[lang]) {
      checks.push({ name: `Strings: ${lang}`, pass: false });
      console.log(`  ❌ Missing language: ${lang}`);
      return;
    }
    requiredKeys.forEach(key => {
      const pass = !!STRINGS[lang][key];
      checks.push({ name: `Strings: ${lang}.${key}`, pass });
      if (!pass) console.log(`  ❌ Missing key: ${lang}.${key}`);
    });
    console.log(`  ✅ Language ${lang}: ${requiredKeys.length} keys verified`);
  });

  if (existsSync(DEPLOY_DIR)) {
    const kitManifest = join(DEPLOY_DIR, 'kits', regionKey, 'manifest.json');
    if (existsSync(kitManifest)) {
      checks.push({ name: 'Kit manifest', pass: true });
      console.log(`  ✅ Kit manifest exists`);
    } else {
      console.log(`  ⚠️  Kit not built — run 'node deploy.js kit ${regionKey}'`);
    }
  } else {
    console.log(`  ⚠️  Deploy directory not found — run 'node deploy.js all ${regionKey}'`);
  }

  const passed = checks.filter(c => c.pass).length;
  console.log(`\n  ${passed}/${checks.length} checks passed`);
  return passed === checks.length;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const target = args[1] || 'global';

  if (target !== 'global' && command !== 'help' && !REGIONS[target]) {
    console.error(`❌ Unknown region: ${target}`);
    console.error('   Available: ' + Object.keys(REGIONS).join(', '));
    process.exit(1);
  }

  switch (command) {
    case 'kit': await buildKit(target); break;
    case 'docs': await buildDocs(target); break;
    case 'translate': await buildTranslations(target); break;
    case 'train': await buildTraining(target); break;
    case 'partner': await buildPartnerPackage(target); break;
    case 'impact': await buildImpactTracking(target); break;
    case 'all': await buildAll(target); break;
    case 'test': process.exit((await testDeployment(target)) ? 0 : 1);
    case 'ship':
      console.log(`\n📦 Shipping Lighthouse to ${REGIONS[target].name}...\n`);
      await buildAll(target);
      console.log(`\n✅ Ready for ${target}!`);
      console.log(`   Greetings: ${Object.values(REGIONS[target].greeting).join(' | ')}\n`);
      break;
    default:
      console.log(`
⚡ Lighthouse Field Deployment System v${VERSION}

Commands:
  node deploy.js kit [region]        Build Community Kit
  node deploy.js docs [region]       Generate documentation
  node deploy.js translate [region]  Generate translations
  node deploy.js train [region]      Build training materials
  node deploy.js partner [region]    Partnership package
  node deploy.js impact [region]     Impact tracking setup
  node deploy.js all [region]        Run all
  node deploy.js ship <region>       Package for specific region
  node deploy.js test [region]       Verify deployment

Regions: ${Object.keys(REGIONS).join(', ')}

Examples:
  node deploy.js ship east-africa
  node deploy.js test global
`);
  }
}

main().catch(err => {
  console.error('❌ Deployment failed:', err.message);
  process.exit(1);
});
