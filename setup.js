#!/usr/bin/env node
const { existsSync, mkdirSync, createWriteStream, statSync, unlinkSync, renameSync } = require('fs');
const { join } = require('path');

const MODEL_DIR = join(__dirname, 'models');
const MODEL_FILE = join(MODEL_DIR, 'model.gguf');
const TMP_FILE = MODEL_FILE + '.tmp';
const MODEL_URLS = [
  'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
  'https://huggingface.co/TheBloke/CodeQwen1.5-7B-Chat-GGUF/resolve/main/codeqwen-1_5-7b-chat-q4_k_m.gguf'
];

async function main() {
  console.log('\n📥 Lighthouse Setup\n');

  if (!existsSync(MODEL_DIR)) mkdirSync(MODEL_DIR, { recursive: true });

  if (existsSync(MODEL_FILE)) {
    const sizeGB = statSync(MODEL_FILE).size / 1024 / 1024 / 1024;
    if (sizeGB > 1.0) {
      console.log(`✅ Model exists (${sizeGB.toFixed(1)}GB)`);
      console.log('   Start: node core.js\n');
      return;
    } else {
      console.log('⚠️  Model file seems incomplete (<1GB). Redownloading...');
      try { unlinkSync(MODEL_FILE); } catch {}
    }
  }

  if (existsSync(TMP_FILE)) {
    console.log('Found partial download. Removing to start fresh...');
    try { unlinkSync(TMP_FILE); } catch {}
  }

  let downloaded = false;

  for (const url of MODEL_URLS) {
    if (downloaded) break;
    const filename = url.split('/').pop();
    console.log(`\n📥 Trying: ${filename}`);
    console.log('   (This is a one-time ~4GB download. Works fully offline after.)\n');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const total = parseInt(res.headers.get('content-length') || '0');
      let received = 0;
      const fileStream = createWriteStream(TMP_FILE);
      let lastLog = Date.now();

      for await (const chunk of res.body) {
        fileStream.write(chunk);
        received += chunk.length;

        if (Date.now() - lastLog > 1000) {
          lastLog = Date.now();
          if (total > 0) {
            const pct = ((received / total) * 100).toFixed(1);
            const mb = (received / 1024 / 1024).toFixed(0);
            const totalMb = (total / 1024 / 1024).toFixed(0);
            process.stdout.write(`\r   ${pct}% — ${mb}/${totalMb} MB`);
          } else {
            const mb = (received / 1024 / 1024).toFixed(0);
            process.stdout.write(`\r   ${mb} MB downloaded...`);
          }
        }
      }

      fileStream.end();
      console.log('');

      const finalSize = statSync(TMP_FILE).size;
      const finalSizeGB = finalSize / 1024 / 1024 / 1024;

      if (finalSizeGB < 1.0) {
        throw new Error(`Download too small (${finalSizeGB.toFixed(1)}GB). Expected ~4GB.`);
      }

      renameSync(TMP_FILE, MODEL_FILE);
      console.log(`✅ Download complete! (${finalSizeGB.toFixed(1)}GB)\n`);
      downloaded = true;

    } catch (err) {
      console.log(`\n❌ Failed: ${err.message}`);
      try { unlinkSync(TMP_FILE); } catch {}
      console.log('   Trying next URL...\n');
    }
  }

  if (!downloaded) {
    console.log('❌ All download attempts failed.');
    console.log('   Check your internet connection and try again.');
    console.log('   Or manually download a GGUF model and place it at:');
    console.log(`   ${MODEL_FILE}\n`);
    console.log('   Recommended models:');
    console.log('   - Qwen2.5-Coder-7B-Instruct-Q4_K_M (good quality, ~4GB)');
    console.log('   - CodeQwen1.5-7B-Chat-Q4_K_M (fast, ~4GB)\n');
    process.exit(1);
  }

  console.log('🚀 Ready! Start the agent:');
  console.log('   node core.js');
  console.log('   Then open http://localhost:8899\n');
}

main();
