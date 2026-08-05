#!/usr/bin/env node
// setup.js — Cross-platform model downloader
const { existsSync, mkdirSync, createWriteStream, statSync } = require('fs');
const { join } = require('path');

const MODEL_DIR = join(__dirname, 'models');
const MODEL_FILE = join(MODEL_DIR, 'model.gguf');
const MODEL_URLS = [
  'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
  'https://huggingface.co/TheBloke/CodeQwen1.5-7B-Chat-GGUF/resolve/main/codeqwen-1_5-7b-chat-q4_k_m.gguf'
];

async function main() {
  console.log('\n📥 Lighthouse Setup\n');

  if (!existsSync(MODEL_DIR)) mkdirSync(MODEL_DIR, { recursive: true });

  if (existsSync(MODEL_FILE)) {
    const size = (statSync(MODEL_FILE).size / 1024 / 1024 / 1024).toFixed(1);
    console.log(`✅ Model already exists (${size}GB)`);
    console.log('   Start: node core.js\n');
    return;
  }

  console.log('Downloading AI model (~4GB, one-time)...\n');

  const controller = new AbortController();
  let downloaded = false;

  for (const url of MODEL_URLS) {
    if (downloaded) break;
    console.log(`Trying: ${url.split('/').pop()}\n`);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const total = parseInt(res.headers.get('content-length') || '0');
      let received = 0;

      const fileStream = createWriteStream(MODEL_FILE);

      for await (const chunk of res.body) {
        fileStream.write(chunk);
        received += chunk.length;
        if (total > 0) {
          const pct = ((received / total) * 100).toFixed(1);
          const mb = (received / 1024 / 1024).toFixed(0);
          process.stdout.write(`\r   ${pct}% (${mb}MB)`);
        }
      }

      fileStream.end();
      console.log('\n✅ Download complete!\n');
      downloaded = true;
      break;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
      try { require('fs').unlinkSync(MODEL_FILE); } catch {}
    }
  }

  if (!downloaded) {
    console.log('\n❌ All download attempts failed.');
    console.log('   Check your internet connection and try again.');
    console.log('   You can also manually download a GGUF model and place it at:');
    console.log(`   ${MODEL_FILE}\n`);
    process.exit(1);
  }

  console.log('🚀 Ready! Start the agent:');
  console.log('   node core.js\n');
}

main();
