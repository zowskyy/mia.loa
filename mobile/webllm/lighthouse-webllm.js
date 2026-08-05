/*
  EXPERIMENTAL: On-device model inference using WebLLM
  Requires: Chrome 127+ with WebGPU enabled
  Model: ~2GB quantized, runs entirely in browser
*/

class OnDeviceModel {
  constructor() {
    this.engine = null;
    this.ready = false;
    this.loading = false;
  }

  static async isSupported() {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async init(onProgress) {
    if (this.ready) return true;
    if (this.loading) {
      while (this.loading) await new Promise(r => setTimeout(r, 200));
      return this.ready;
    }

    this.loading = true;

    try {
      const { CreateMLCEngine } = await import(
        'https://esm.run/@mlc-ai/web-llm@0.2.79'
      );

      this.engine = await CreateMLCEngine('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', {
        initProgressCallback: (progress) => {
          const pct = Math.round((progress.progress || 0) * 100);
          if (onProgress) onProgress(pct, progress.text || 'Loading...');
        }
      });

      this.ready = true;
      return true;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt, system = '') {
    if (!this.ready) throw new Error('Model not loaded');

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const reply = await this.engine.chat.completions.create({
      messages,
      temperature: 0.1,
      max_tokens: 1024,
      stream: false
    });

    return reply.choices[0].message.content;
  }

  async generateStream(prompt, system, onToken) {
    if (!this.ready) throw new Error('Model not loaded');

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: 0.1,
      max_tokens: 1024,
      stream: true
    });

    let fullText = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      fullText += token;
      if (onToken) onToken(token);
    }
    return fullText;
  }
}

if (typeof window !== 'undefined') {
  window.OnDeviceModel = OnDeviceModel;
}
