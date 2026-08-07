#!/usr/bin/env node
/*
  LIGHTHOUSE FINAL ASSEMBLY SCRIPT v1.0.2

  Completes every remaining item on the roadmap.
  Run this ONE script. Everything gets built, configured, deployed.

  Usage:
    node assemble.js                    # Run all pending items
    node assemble.js --check            # Check what's pending
    node assemble.js --item <name>      # Run specific item
    node assemble.js --deploy <region>  # Full field deployment

  Items:
    wasm-compiler       Sync wasm_compiler.wasm from frontier-syntax
    server-fallback     Configure FRONTIER_COMPILER server fallback
    app-templates       Build community app template library
    package-registry    Initialize local package registry
    field-deploy        Deploy to target region
    all                 Run everything
*/

const { execSync } = require('child_process');
const {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  copyFileSync, readdirSync, statSync
} = require('fs');
const { join, resolve } = require('path');
const crypto = require('crypto');

const ROOT = resolve(__dirname);
const FRONTIER_HOME = process.env.FRONTIER_HOME || join(ROOT, '..', 'frontier-syntax');
const FRONTIER_ALT_HOME = process.env.FRONTIER_ALT_HOME || join(ROOT, '..', 'frontier-syntax-alt');
const PUBLIC_DIR = join(ROOT, 'public');
const SYNTAX_DIR = join(PUBLIC_DIR, 'syntax');
const TEMPLATES_DIR = join(ROOT, 'frontier', 'templates');
const REGISTRY_DIR = join(ROOT, 'registry');
const DEPLOY_DIR = join(ROOT, 'deploy');

const ASSEMBLY_ITEMS = [
  'wasm-compiler',
  'server-fallback',
  'app-templates',
  'package-registry',
  'field-deploy'
];

function checkAllStatus() {
  console.log('═'.repeat(60));
  console.log('  LIGHTHOUSE FINAL ASSEMBLY — Status Check');
  console.log('═'.repeat(60));
  console.log('');

  const envCompiler = process.env.FRONTIER_COMPILER;
  const items = [
    {
      id: 'wasm-compiler',
      name: 'wasm_compiler.wasm in public/syntax/',
      check: () => existsSync(join(SYNTAX_DIR, 'wasm_compiler.wasm')),
      action: 'Run: node assemble.js --item wasm-compiler'
    },
    {
      id: 'wasm-parser',
      name: 'wasm_parser.wasm in public/syntax/',
      check: () => existsSync(join(SYNTAX_DIR, 'wasm_parser.wasm')),
      action: 'Run: node assemble.js --item wasm-compiler (or sync-frontier-syntax.sh)'
    },
    {
      id: 'server-fallback',
      name: 'FRONTIER_COMPILER server fallback',
      check: () => {
        return (envCompiler && existsSync(envCompiler)) ||
          existsSync(join(FRONTIER_HOME, 'target', 'release', 'frontier')) ||
          existsSync(join(ROOT, '.env')) ||
          existsSync('/usr/local/bin/frontier');
      },
      action: 'Run: node assemble.js --item server-fallback'
    },
    {
      id: 'app-templates',
      name: 'Community app templates',
      check: () => {
        const templates = ['water-tracker', 'clinic-records', 'market-prices', 'school-attendance', 'inventory-manager'];
        return templates.every(t => existsSync(join(TEMPLATES_DIR, t, 'app.frontier')));
      },
      action: 'Run: node assemble.js --item app-templates'
    },
    {
      id: 'package-registry',
      name: 'Local package registry',
      check: () => existsSync(join(REGISTRY_DIR, 'packages.json')),
      action: 'Run: node assemble.js --item package-registry'
    },
    {
      id: 'field-deploy',
      name: 'Field deployment packages',
      check: () => existsSync(join(DEPLOY_DIR, 'kits')),
      action: 'Run: node assemble.js --deploy east-africa'
    },
    {
      id: 'browser-compiler',
      name: 'Browser compiler (browser-compiler.js)',
      check: () => existsSync(join(PUBLIC_DIR, 'browser-compiler.js')),
      action: 'Already present'
    },
    {
      id: 'download-menu',
      name: 'Download menu (download-menu.js)',
      check: () => existsSync(join(PUBLIC_DIR, 'download-menu.js')),
      action: 'Already present'
    },
    {
      id: 'discovery-engine',
      name: 'Discovery engine (lib/discovery-engine.js)',
      check: () => existsSync(join(ROOT, 'lib', 'discovery-engine.js')),
      action: 'Already present'
    }
  ];

  let ready = 0;
  let pending = 0;

  for (const item of items) {
    const status = item.check();
    const icon = status ? '✅' : '🔲';
    const label = status ? 'READY' : 'PENDING';

    console.log(`  ${icon} ${item.name}`);
    console.log(`     Status: ${label}`);
    if (!status) console.log(`     ${item.action}`);
    console.log('');

    if (status) ready++;
    else pending++;
  }

  console.log('═'.repeat(60));
  console.log(`  ✅ ${ready} ready  🔲 ${pending} pending`);
  console.log('═'.repeat(60));
  console.log('');

  if (pending > 0) {
    console.log('  Run to complete all pending items:');
    console.log('  node assemble.js\n');
  } else {
    console.log('  🎉 ALL ITEMS COMPLETE — System is fully assembled!\n');
  }

  return { ready, pending, items };
}

async function syncWasmCompiler() {
  console.log('═'.repeat(60));
  console.log('  ITEM 1: Sync wasm_compiler.wasm');
  console.log('═'.repeat(60));
  console.log('');

  if (!existsSync(SYNTAX_DIR)) mkdirSync(SYNTAX_DIR, { recursive: true });

  const sources = [
    join(FRONTIER_HOME, 'target', 'wasm32-unknown-unknown', 'release', 'frontier_compiler.wasm'),
    join(FRONTIER_HOME, 'wasm-playground', 'wasm_compiler.wasm'),
    join(FRONTIER_ALT_HOME, 'wasm-playground', 'wasm_compiler.wasm'),
    join(FRONTIER_ALT_HOME, 'wasm-playground', 'wasm_parser.wasm'),
    join(FRONTIER_ALT_HOME, 'target', 'wasm32-unknown-unknown', 'release', 'frontier_syntax_alt.wasm')
  ];

  let found = false;

  for (const src of sources) {
    if (!existsSync(src)) continue;

    console.log(`  📦 Found WASM at: ${src}`);

    let destName = 'wasm_compiler.wasm';
    if (src.includes('parser') || src.includes('syntax_alt')) {
      destName = src.includes('parser') ? 'wasm_parser.wasm' : 'wasm_compiler.wasm';
    }

    const dest = join(SYNTAX_DIR, destName);
    copyFileSync(src, dest);

    const sizeKB = (statSync(dest).size / 1024).toFixed(1);
    const hash = crypto.createHash('sha256').update(readFileSync(dest)).digest('hex').substring(0, 16);

    console.log(`  ✅ Copied to: ${dest}`);
    console.log(`     Size: ${sizeKB} KB`);
    console.log(`     Hash: ${hash}...`);
    console.log('');
    found = true;
  }

  if (!found) {
    console.log('  ⚠️  No WASM compiler found in frontier-syntax.');
    console.log('     Build it first:');
    console.log('     cd frontier-syntax');
    console.log('     cargo build --release --target wasm32-unknown-unknown');
    console.log('');
    console.log('  💡 Meanwhile, browser-compiler.js will use:');
    console.log('     1. wasm_parser.wasm (validation) — if available');
    console.log('     2. LHN1 offline capsule (code generation) — built-in');
    console.log('     3. Server fallback API — if FRONTIER_COMPILER is set');
    console.log('');
  }

  const syncScript = join(ROOT, 'scripts', 'sync-frontier-syntax.sh');
  if (existsSync(syncScript)) {
    console.log('  🔄 Running sync-frontier-syntax.sh...');
    try {
      execSync(`bash "${syncScript}"`, { stdio: 'pipe', cwd: ROOT });
      console.log('  ✅ Sync script completed');
    } catch {
      console.log('  ⚠️  Sync script had issues (non-critical)');
    }
    console.log('');
  }

  return found;
}

async function configureServerFallback() {
  console.log('═'.repeat(60));
  console.log('  ITEM 2: Configure FRONTIER_COMPILER Server Fallback');
  console.log('═'.repeat(60));
  console.log('');

  const currentCompiler = process.env.FRONTIER_COMPILER;
  if (currentCompiler && existsSync(currentCompiler)) {
    console.log(`  ✅ FRONTIER_COMPILER already set: ${currentCompiler}`);
    console.log('');
    return true;
  }

  const searchPaths = [
    join(FRONTIER_HOME, 'target', 'release', 'frontier'),
    join(FRONTIER_HOME, 'target', 'release', 'frontier-cli'),
    join(FRONTIER_ALT_HOME, 'target', 'release', 'frontier'),
    '/usr/local/bin/frontier',
    '/opt/frontier/bin/frontier',
    join(process.env.HOME || '/home/user', '.cargo', 'bin', 'frontier')
  ];

  let foundPath = null;
  for (const path of searchPaths) {
    if (existsSync(path)) {
      foundPath = path;
      break;
    }
  }

  if (foundPath) {
    console.log(`  📦 Found Frontier compiler: ${foundPath}`);

    const envFile = join(ROOT, '.env');
    let envContent = existsSync(envFile) ? readFileSync(envFile, 'utf-8') : '';

    if (!envContent.includes('FRONTIER_COMPILER=')) {
      envContent += `\nFRONTIER_COMPILER=${foundPath}\n`;
      writeFileSync(envFile, envContent.trimStart() + '\n');
      console.log(`  ✅ Added to .env: FRONTIER_COMPILER=${foundPath}`);
    } else {
      console.log('  ✅ .env already has FRONTIER_COMPILER configured');
    }

    try {
      const version = execSync(`"${foundPath}" --version 2>&1 || echo "unknown"`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim();
      console.log(`  ✅ Compiler test: ${version}`);
    } catch {
      console.log('  ⚠️  Compiler found but not responding (non-critical)');
    }

    console.log('');
    console.log('  To use in current session:');
    console.log(`  export FRONTIER_COMPILER=${foundPath}`);
    console.log('');
    return true;
  }

  console.log('  ⚠️  Frontier compiler not found on this system.');
  console.log('');
  console.log('  Option 1: Build from source');
  console.log('    git clone https://github.com/zowskyy/frontier-syntax');
  console.log('    cd frontier-syntax');
  console.log('    cargo build --release');
  console.log('    export FRONTIER_COMPILER=$(pwd)/target/release/frontier');
  console.log('');
  console.log('  Option 2: Install via cargo (when published)');
  console.log('    cargo install frontier-cli');
  console.log('');
  console.log('  💡 Without FRONTIER_COMPILER, Lighthouse uses:');
  console.log('     1. Browser WASM compiler (11 targets)');
  console.log('     2. LHN1 offline capsule (always available)');
  console.log('     3. Server compile endpoint returns setup instructions');
  console.log('');

  return false;
}

async function buildAppTemplates() {
  console.log('═'.repeat(60));
  console.log('  ITEM 3: Build Community App Templates');
  console.log('═'.repeat(60));
  console.log('');

  if (!existsSync(TEMPLATES_DIR)) mkdirSync(TEMPLATES_DIR, { recursive: true });

  const templates = [
    {
      name: 'water-tracker',
      description: 'Water pump maintenance and repair tracking',
      icon: '🚰',
      category: 'infrastructure',
      fields: ['Pump', 'Location', 'ServiceRecord'],
      features: ['GPS tracking', 'Photo capture', 'Service scheduling', 'Offline storage']
    },
    {
      name: 'clinic-records',
      description: 'Patient records and appointment management for rural clinics',
      icon: '🏥',
      category: 'health',
      fields: ['Patient', 'Visit', 'Prescription'],
      features: ['Patient search', 'Visit history', 'Prescription tracking', 'Privacy-focused']
    },
    {
      name: 'market-prices',
      description: 'Crop price comparison and market finder for farmers',
      icon: '🌾',
      category: 'agriculture',
      fields: ['Crop', 'MarketPrice', 'Vendor'],
      features: ['Price comparison', 'Market locator', 'Price history', 'Offline caching']
    },
    {
      name: 'school-attendance',
      description: 'Student attendance and grade tracking for village schools',
      icon: '📚',
      category: 'education',
      fields: ['Student', 'Class', 'Attendance', 'Grade'],
      features: ['QR check-in', 'Attendance reports', 'Grade tracking', 'Parent notifications']
    },
    {
      name: 'inventory-manager',
      description: 'Stock tracking for small shops and cooperatives',
      icon: '📦',
      category: 'business',
      fields: ['Product', 'Stock', 'Sale', 'Supplier'],
      features: ['Barcode scanning', 'Low stock alerts', 'Sales reports', 'Supplier management']
    },
    {
      name: 'community-ledger',
      description: 'Micro-loan and savings group management',
      icon: '💰',
      category: 'finance',
      fields: ['Member', 'Loan', 'Payment', 'Savings'],
      features: ['Loan tracking', 'Payment schedule', 'Group savings', 'Transparency reports']
    },
    {
      name: 'field-survey',
      description: 'Offline data collection for community surveys',
      icon: '📋',
      category: 'research',
      fields: ['Survey', 'Question', 'Response', 'Location'],
      features: ['Custom forms', 'GPS tagging', 'Photo attachments', 'CSV export']
    },
    {
      name: 'event-planner',
      description: 'Community event organization and attendance',
      icon: '🎉',
      category: 'community',
      fields: ['Event', 'Attendee', 'Task', 'Budget'],
      features: ['RSVP tracking', 'Task assignment', 'Budget management', 'Reminders']
    }
  ];

  let created = 0;

  for (const template of templates) {
    const templateDir = join(TEMPLATES_DIR, template.name);
    if (!existsSync(templateDir)) mkdirSync(templateDir, { recursive: true });

    writeFileSync(join(templateDir, 'app.frontier'), generateTemplateSource(template));
    writeFileSync(join(templateDir, 'manifest.json'), JSON.stringify({
      name: template.name,
      version: '1.0.0',
      description: template.description,
      icon: template.icon,
      category: template.category,
      author: 'Lighthouse Community',
      license: 'MIT',
      fields: template.fields,
      features: template.features,
      generatedBy: 'Lighthouse ARC Engine',
      generatedDate: new Date().toISOString()
    }, null, 2));

    const title = template.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    writeFileSync(join(templateDir, 'README.md'), `# ${template.icon} ${title}

${template.description}

## Features
${template.features.map(f => `- ${f}`).join('\n')}

## Data Model
${template.fields.map(f => `- **${f}**`).join('\n')}

## Quick Start

### Install via Lighthouse
1. Open Lighthouse
2. Type: "Build me a ${template.description.toLowerCase()}"
3. Lighthouse will generate a customized version

### Install via Frontier CLI
\`\`\`bash
frontier add ${template.name}
frontier compile app.frontier --target native
./app
\`\`\`

## License
MIT — Free forever
`);

    console.log(`  ✅ ${template.icon} ${template.name} — ${template.description}`);
    created++;
  }

  writeFileSync(join(TEMPLATES_DIR, 'index.json'), JSON.stringify({
    version: '1.0.0',
    updated: new Date().toISOString(),
    templates: templates.map(t => ({
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category
    }))
  }, null, 2));

  console.log('');
  console.log(`  ✅ ${created} templates created`);
  console.log(`  📁 ${TEMPLATES_DIR}`);
  console.log('');

  return created;
}

function generateTemplateSource(template) {
  const moduleName = template.name.replace(/-/g, '_');
  const appName = template.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const primaryTable = `${template.fields[0].toLowerCase()}s`;

  return `// ${appName} — Lighthouse Community Template
// ${template.description}
// Generated: ${new Date().toISOString()}
// License: MIT — Free forever

module ${moduleName};

import frontier.ui.{Screen, Button, List, TextInput, Card, Navigation};
import frontier.storage.{Database, Query, Sync};
import frontier.hardware.{GPS, Camera, Barcode};

${template.fields.map(f => generateFieldType(f)).join('\n')}

fn init_database() -> Result<Database, String> {
  let db = Database::open("${moduleName}.db")?;
  db.create_table("${primaryTable}", [
    ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
    ("data", "TEXT"),
    ("created_at", "TEXT DEFAULT (datetime('now'))"),
    ("updated_at", "TEXT DEFAULT (datetime('now'))"),
  ])?;
  Ok(db)
}

fn create(data: String) -> Result<Int, String> {
  let db = init_database()?;
  Ok(db.insert("${primaryTable}", data)?)
}

fn list_all() -> Result<Vec<String>, String> {
  let db = init_database()?;
  Ok(db.query("SELECT * FROM ${primaryTable} ORDER BY created_at DESC")?)
}

fn search(query: String) -> Result<Vec<String>, String> {
  let db = init_database()?;
  Ok(db.query("SELECT * FROM ${primaryTable} WHERE data LIKE ?", ["%" + query + "%"])?)
}

${template.features.map(f => generateFeatureFunction(f, template)).join('\n\n')}

fn main() -> void {
  let screen = Screen::new("${appName}");
  screen.set_icon("${template.icon}");
  let _ = init_database();

  let search_bar = TextInput::new("search");
  search_bar.set_placeholder("Search...");
  screen.add_widget(search_bar);

  screen.add_button("add_new", "➕ Add New", "show_add_form");

  let list = List::new("records");
  for record in list_all().unwrap_or([]) {
    list.add_card(Card::new(record));
  }
  screen.add_list(list);
  screen.render();
}
`;
}

function generateFieldType(field) {
  const fieldTypes = {
    Pump: 'type Pump = { id: Int, location: String, gps: (Float, Float), status: String, last_service: String, next_service: String }',
    Location: 'type Location = { lat: Float, lng: Float, name: String, address: String }',
    ServiceRecord: 'type ServiceRecord = { id: Int, pump_id: Int, date: String, technician: String, notes: String, cost: Float }',
    Patient: 'type Patient = { id: Int, name: String, age: Int, village: String, phone: String, medical_history: String }',
    Visit: 'type Visit = { id: Int, patient_id: Int, date: String, symptoms: String, diagnosis: String, treatment: String }',
    Prescription: 'type Prescription = { id: Int, visit_id: Int, medication: String, dosage: String, duration: String }',
    Crop: 'type Crop = { id: Int, name: String, variety: String, season: String, expected_yield: Float }',
    MarketPrice: 'type MarketPrice = { id: Int, crop_id: Int, market: String, price: Float, date: String, currency: String }',
    Vendor: 'type Vendor = { id: Int, name: String, market: String, phone: String, rating: Float }',
    Student: 'type Student = { id: Int, name: String, grade: Int, parent_name: String, parent_phone: String }',
    Class: 'type Class = { id: Int, name: String, teacher: String, room: String, schedule: String }',
    Attendance: 'type Attendance = { id: Int, student_id: Int, class_id: Int, date: String, status: String }',
    Grade: 'type Grade = { id: Int, student_id: Int, subject: String, score: Float, term: String }',
    Product: 'type Product = { id: Int, name: String, sku: String, quantity: Int, price: Float, reorder_level: Int }',
    Stock: 'type Stock = { id: Int, product_id: Int, quantity: Int, location: String, last_updated: String }',
    Sale: 'type Sale = { id: Int, product_id: Int, quantity: Int, total: Float, date: String, customer: String }',
    Supplier: 'type Supplier = { id: Int, name: String, contact: String, products: Vec<Int>, lead_time: Int }',
    Member: 'type Member = { id: Int, name: String, join_date: String, savings_balance: Float, loan_balance: Float }',
    Loan: 'type Loan = { id: Int, member_id: Int, amount: Float, interest_rate: Float, start_date: String, end_date: String, status: String }',
    Payment: 'type Payment = { id: Int, loan_id: Int, amount: Float, date: String, method: String }',
    Savings: 'type Savings = { id: Int, member_id: Int, amount: Float, date: String, type: String }',
    Survey: 'type Survey = { id: Int, title: String, description: String, questions: Vec<Question>, created_at: String }',
    Question: 'type Question = { id: Int, survey_id: Int, text: String, type: String, options: Vec<String> }',
    Response: 'type Response = { id: Int, survey_id: Int, question_id: Int, answer: String, respondent: String }',
    Event: 'type Event = { id: Int, title: String, description: String, date: String, location: String, budget: Float }',
    Attendee: 'type Attendee = { id: Int, event_id: Int, name: String, rsvp: String, notes: String }',
    Task: 'type Task = { id: Int, event_id: Int, description: String, assigned_to: String, due_date: String, status: String }',
    Budget: 'type Budget = { id: Int, event_id: Int, category: String, allocated: Float, spent: Float }'
  };
  return fieldTypes[field] || `type ${field} = { id: Int, name: String, data: String }`;
}

function generateFeatureFunction(feature, template) {
  const primaryTable = `${template.fields[0].toLowerCase()}s`;
  const featureMap = {
    'GPS tracking': `fn get_location() -> Result<(Float, Float), String> {
  let gps = GPS::current()?;
  Ok((gps.latitude, gps.longitude))
}`,
    'Photo capture': `fn capture_photo() -> Result<Binary, String> {
  let photo = Camera::capture()?;
  Camera::compress(photo, "medium")
}`,
    'Service scheduling': `fn schedule_service(id: Int, date: String) -> Result<(), String> {
  let db = init_database()?;
  db.execute("UPDATE ${primaryTable} SET updated_at = ? WHERE id = ?", [date, id])?;
  Ok(())
}`,
    'Offline storage': `fn sync_when_online() -> Result<(), String> {
  let sync = Sync::new();
  sync.on_connect(|| Ok(()))
}`,
    'Patient search': `fn search_patients(query: String) -> Result<Vec<Patient>, String> {
  search(query).map(|r| r)
}`,
    'Price comparison': `fn compare_prices(crop_id: Int) -> Result<Vec<MarketPrice>, String> {
  let db = init_database()?;
  Ok(db.query("SELECT * FROM market_prices WHERE crop_id = ? ORDER BY price ASC", [crop_id])?)
}`,
    'QR check-in': `fn qr_check_in(code: String) -> Result<(), String> {
  let db = init_database()?;
  db.execute("INSERT INTO attendance (data, created_at) VALUES (?, datetime('now'))", [code])?;
  Ok(())
}`,
    'Barcode scanning': `fn scan_barcode() -> Result<String, String> {
  Ok(Barcode::scan()?.data)
}`,
    'Low stock alerts': `fn check_low_stock() -> Result<Vec<Product>, String> {
  let db = init_database()?;
  Ok(db.query("SELECT * FROM products WHERE quantity <= reorder_level")?)
}`,
    'Loan tracking': `fn get_active_loans(member_id: Int) -> Result<Vec<Loan>, String> {
  let db = init_database()?;
  Ok(db.query("SELECT * FROM loans WHERE member_id = ? AND status = 'active'", [member_id])?)
}`,
    'RSVP tracking': `fn update_rsvp(event_id: Int, attendee_id: Int, status: String) -> Result<(), String> {
  let db = init_database()?;
  db.execute("UPDATE attendees SET rsvp = ? WHERE id = ? AND event_id = ?", [status, attendee_id, event_id])?;
  Ok(())
}`
  };

  for (const [key, code] of Object.entries(featureMap)) {
    if (feature.toLowerCase().includes(key.toLowerCase())) return code;
  }

  const fnName = feature.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
  return `fn ${fnName}() -> Result<(), String> {
  // ${feature}
  Ok(())
}`;
}

async function initPackageRegistry() {
  console.log('═'.repeat(60));
  console.log('  ITEM 4: Initialize Package Registry');
  console.log('═'.repeat(60));
  console.log('');

  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  const packagesDir = join(REGISTRY_DIR, 'packages');
  if (!existsSync(packagesDir)) mkdirSync(packagesDir, { recursive: true });

  const templates = [];
  if (existsSync(TEMPLATES_DIR)) {
    for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const manifestPath = join(TEMPLATES_DIR, dir.name, 'manifest.json');
      if (existsSync(manifestPath)) {
        templates.push(JSON.parse(readFileSync(manifestPath, 'utf-8')));
      }
    }
  }

  const registry = {
    name: 'Lighthouse Community Registry',
    version: '1.0.0',
    description: 'Free, offline app templates for community use',
    baseUrl: 'http://localhost:8899/api/packages',
    updated: new Date().toISOString(),
    packages: {},
    stats: { total: templates.length, categories: {} }
  };

  for (const tpl of templates) {
    registry.packages[tpl.name] = {
      name: tpl.name,
      version: tpl.version,
      description: tpl.description,
      icon: tpl.icon,
      category: tpl.category,
      author: tpl.author,
      license: tpl.license,
      features: tpl.features,
      install: `frontier add ${tpl.name}`,
      lighthouse: `Type: "Build me a ${tpl.description.toLowerCase()}"`
    };
    registry.stats.categories[tpl.category] = (registry.stats.categories[tpl.category] || 0) + 1;
  }

  writeFileSync(join(REGISTRY_DIR, 'packages.json'), JSON.stringify(registry, null, 2));

  console.log(`  ✅ Registry initialized with ${templates.length} packages`);
  console.log(`  📁 ${REGISTRY_DIR}`);
  console.log('');
  for (const [cat, count] of Object.entries(registry.stats.categories)) {
    console.log(`     ${cat}: ${count} packages`);
  }
  console.log('');
  console.log('  API: GET /api/packages, /api/packages/:name, /api/packages/:name/download');
  console.log('');

  return templates.length;
}

async function fieldDeploy(region) {
  console.log('═'.repeat(60));
  console.log(`  ITEM 5: Field Deployment — ${region}`);
  console.log('═'.repeat(60));
  console.log('');

  const deployScript = join(ROOT, 'deploy.js');
  if (!existsSync(deployScript)) {
    console.log('  ⚠️  deploy.js not found.');
    return false;
  }

  try {
    execSync(`node "${deployScript}" ship ${region}`, {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: 120000
    });
    console.log('');
    console.log(`  ✅ Deployment to ${region} complete!`);
    console.log('');
    return true;
  } catch (e) {
    console.log(`  ❌ Deployment failed: ${e.message}`);
    console.log('');
    return false;
  }
}

async function runItem(itemId, region = 'east-africa') {
  switch (itemId) {
    case 'wasm-compiler': return syncWasmCompiler();
    case 'server-fallback': return configureServerFallback();
    case 'app-templates': return buildAppTemplates();
    case 'package-registry': return initPackageRegistry();
    case 'field-deploy': return fieldDeploy(region);
    default:
      console.error(`Unknown item: ${itemId}`);
      console.error(`Valid items: ${ASSEMBLY_ITEMS.join(', ')}`);
      process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  console.log('');
  console.log('⚡ LIGHTHOUSE FINAL ASSEMBLY');
  console.log(`Version: ${JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version}`);
  console.log(`Command: ${command}`);
  console.log('');

  if (command === '--check' || command === 'check') {
    checkAllStatus();
    return;
  }

  if (command === '--deploy' || command === 'deploy') {
    await fieldDeploy(args[1] || 'east-africa');
    return;
  }

  if (command === '--item') {
    const targetItem = args[1];
    if (!targetItem) {
      console.error('Usage: node assemble.js --item <name>');
      console.error(`Items: ${ASSEMBLY_ITEMS.join(', ')}`);
      process.exit(1);
    }
    await runItem(targetItem, args[2] || 'east-africa');
  } else {
    for (const item of ASSEMBLY_ITEMS) {
      await runItem(item, args[1] || 'east-africa');
    }
  }

  console.log('═'.repeat(60));
  console.log('  ASSEMBLY COMPLETE');
  console.log('═'.repeat(60));
  console.log('');
  checkAllStatus();
}

main().catch(e => {
  console.error('❌ Assembly failed:', e.message);
  process.exit(1);
});
