#!/usr/bin/env node
/*
  FRONTIER CODEGEN — Replace JavaScript output with Frontier syntax.
  Lighthouse ARC calls this to emit .fr files that compile to native binaries.
*/

const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const { GENERATED_DIR, slugify } = require('./lib/frontier-utils');

class FrontierCodeGenerator {
  constructor() {
    this.imports = new Set();
    this.functions = [];
    this.mainBody = [];
  }

  generateFromARC(arcResult) {
    const { analysis, plan, code, request } = arcResult || {};
    this.imports.clear();

    let source = '';
    const appName = slugify(
      analysis?.suggestedName ||
      plan?.suggestedName ||
      analysis?.summary ||
      request ||
      'generated_app'
    );

    source += `module ${appName};\n\n`;
    this.detectImports(plan, analysis, code);
    for (const imp of this.imports) {
      source += `import ${imp};\n`;
    }
    source += '\n';

    source += this.generateDataStructures(analysis);
    source += this.generateFromLegacyCode(code);

    if (plan?.steps) {
      for (const step of plan.steps) {
        source += this.generateFunction(step);
      }
    }

    source += this.generateMain(plan, analysis);
    source += '\n';

    return {
      source,
      appName,
      files: [{
        path: `${appName}.fr`,
        content: source,
        description: 'Frontier source — compiles to native binary (no Node.js runtime)',
        language: 'frontier'
      }]
    };
  }

  detectImports(plan, analysis, code) {
    const steps = plan?.steps || [];
    const descriptions = [
      ...steps.map(s => s.description || ''),
      analysis?.summary || '',
      ...(code?.files || []).map(f => `${f.path} ${f.description || ''}`)
    ].join(' ').toLowerCase();

    if (/database|store|save|sqlite|record/.test(descriptions)) {
      this.imports.add('frontier.storage.{Database, Query}');
    }
    if (/ui|screen|button|display|form|list|view/.test(descriptions)) {
      this.imports.add('frontier.ui.{Screen, Button, TextInput, List, Text}');
    }
    if (/http|api|fetch|network|request/.test(descriptions)) {
      this.imports.add('frontier.network.{get, post}');
    }
    if (/ai|model|predict|analyze|infer/.test(descriptions)) {
      this.imports.add('frontier.ai.{LocalModel, Inference}');
    }
    if (/camera|photo|scan|qr/.test(descriptions)) {
      this.imports.add('frontier.hardware.{Camera, Scanner}');
    }
    if (/gps|location|map|coordinate/.test(descriptions)) {
      this.imports.add('frontier.hardware.{GPS, Location}');
    }

    if (!this.imports.size) {
      this.imports.add('frontier.ui.{Screen, Button, Text}');
      this.imports.add('frontier.storage.{Database, Query}');
    }
  }

  generateFromLegacyCode(code) {
    const files = code?.files || [];
    if (!files.length) return '';

    let block = '// ─── Transpiled from ARC reference files ───\n';
    for (const file of files) {
      const name = slugify(file.path?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'module');
      block += `// ref: ${file.path}\n`;
      block += `const REF_${name.toUpperCase()}: String = "${this.escape(file.content?.slice(0, 200) || '')}";\n\n`;
    }
    return block;
  }

  generateDataStructures(analysis) {
    let structs = '';
    const summary = (analysis?.summary || '').toLowerCase();

    if (/track|inventory|manage|pump|item/.test(summary)) {
      structs += `type Item = {\n  id: Int,\n  name: String,\n  quantity: Int,\n  created_at: String,\n};\n\n`;
    }
    if (/customer|user|person|farmer|client/.test(summary)) {
      structs += `type Person = {\n  id: Int,\n  name: String,\n  phone: String,\n  email: Option<String>,\n};\n\n`;
    }
    if (/payment|money|price|transaction/.test(summary)) {
      structs += `type Transaction = {\n  id: Int,\n  amount: Float,\n  currency: String,\n  status: String,\n  timestamp: String,\n};\n\n`;
    }

    return structs;
  }

  generateFunction(step) {
    const name = slugify(step.description || `step_${step.step}`);
    const description = step.description || '';
    const descLower = description.toLowerCase();

    if (/create|add|new|insert/.test(descLower)) {
      return `fn ${name}(data: String) -> Result<Int, String> {\n` +
        `  let db = Database::open("app.db")?;\n` +
        `  let id = db.insert("app_data", data)?;\n` +
        `  Ok(id)\n}\n\n`;
    }
    if (/list|show|view|display|all/.test(descLower)) {
      return `fn ${name}() -> Result<Vec<String>, String> {\n` +
        `  let db = Database::open("app.db")?;\n` +
        `  let results = db.query("SELECT data FROM app_data ORDER BY created_at DESC")?;\n` +
        `  Ok(results)\n}\n\n`;
    }
    if (/update|edit|modify/.test(descLower)) {
      return `fn ${name}(id: Int, data: String) -> Result<(), String> {\n` +
        `  let db = Database::open("app.db")?;\n` +
        `  db.execute("UPDATE app_data SET data = ? WHERE id = ?", [data, id])?;\n` +
        `  Ok(())\n}\n\n`;
    }
    if (/delete|remove/.test(descLower)) {
      return `fn ${name}(id: Int) -> Result<(), String> {\n` +
        `  let db = Database::open("app.db")?;\n` +
        `  db.execute("DELETE FROM app_data WHERE id = ?", [id])?;\n` +
        `  Ok(())\n}\n\n`;
    }
    if (/calculate|compute|analyze|sum|average/.test(descLower)) {
      return `fn ${name}(input: Vec<Float>) -> Float {\n` +
        `  input.iter().sum::<Float>() / input.len() as Float\n}\n\n`;
    }

    return `fn ${name}() -> Result<(), String> {\n` +
      `  // ${description || 'Generated step'}\n` +
      `  Ok(())\n}\n\n`;
  }

  generateMain(plan, analysis) {
    const appTitle = (analysis?.summary || 'Generated App').replace(/"/g, "'");
    const steps = plan?.steps || [];

    let main = `fn main() -> void {\n`;
    main += `  print("Starting: ${appTitle}");\n`;

    if (this.imports.has('frontier.storage.{Database, Query}')) {
      main += `  let _ = Database::open("app.db");\n`;
    }
    if (this.imports.has('frontier.ai.{LocalModel, Inference}')) {
      main += `  let _ = LocalModel::load("models/model.gguf");\n`;
    }
    if (this.imports.has('frontier.ui.{Screen, Button, TextInput, List, Text}')) {
      main += `  let screen = Screen::new("${appTitle}");\n`;
      for (const step of steps) {
        const desc = step.description || '';
        const slug = slugify(desc);
        if (/button|click|action|submit/.test(desc.toLowerCase())) {
          main += `  screen.add_button("${slug}", "${desc.replace(/"/g, "'")}", "${slug}_action");\n`;
        }
        if (/input|form|enter|search/.test(desc.toLowerCase())) {
          main += `  screen.add_text_input("${slug}", "${desc.replace(/"/g, "'")}");\n`;
        }
      }
      main += `  screen.render();\n`;
    }

    for (const step of steps) {
      if (step.action === 'create') {
        main += `  let _ = ${slugify(step.description || 'init')}();\n`;
      }
    }

    main += `}\n`;
    return main;
  }

  escape(text) {
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}

function attachFrontierToArcResult(arcResult) {
  const generator = new FrontierCodeGenerator();
  const result = generator.generateFromARC(arcResult);

  if (!arcResult.code) arcResult.code = { files: [] };
  if (!arcResult.code.files) arcResult.code.files = [];

  const mode = process.env.LIGHTHOUSE_OUTPUT || 'hybrid';

  if (mode === 'frontier') {
    arcResult.code.files = result.files;
    arcResult.code.explanation = 'Frontier-native output — compiles to standalone binary';
  } else {
    const hasFr = arcResult.code.files.some(f => f.path?.endsWith('.fr'));
    if (!hasFr) arcResult.code.files.push(...result.files);
  }

  arcResult.frontier = {
    path: result.files[0].path,
    appName: result.appName,
    target: 'native-all',
    runtime: 'frontier-compiler'
  };

  return arcResult;
}

async function main() {
  const generator = new FrontierCodeGenerator();
  const sampleARC = {
    analysis: { type: 'new_project', summary: 'Water pump maintenance tracker for village' },
    plan: {
      steps: [
        { step: 1, action: 'create', file: 'database', description: 'Create database to store pump records' },
        { step: 2, action: 'create', file: 'ui', description: 'Create main screen with add button and pump list' },
        { step: 3, action: 'create', file: 'add_form', description: 'Add form to input new pump details' },
        { step: 4, action: 'create', file: 'search', description: 'Add search functionality for pumps' }
      ]
    }
  };

  const result = generator.generateFromARC(sampleARC);
  console.log('═'.repeat(60));
  console.log('GENERATED FRONTIER SOURCE');
  console.log('═'.repeat(60));
  console.log(result.source);
  console.log('═'.repeat(60));
  console.log(`Output: ${result.files[0].path}`);
  console.log(`Lines: ${result.source.split('\n').length}`);

  if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(join(GENERATED_DIR, result.files[0].path), result.source);
  console.log(`Saved: ${join(GENERATED_DIR, result.files[0].path)}`);
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { FrontierCodeGenerator, attachFrontierToArcResult };
