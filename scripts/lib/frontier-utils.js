/*
  Shared Frontier build utilities for Lighthouse overhaul scripts.
*/

const { existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const ROOT = join(__dirname, '..', '..');
const FRONTIER_HOME = process.env.FRONTIER_HOME || join(ROOT, '..', 'frontier-syntax');
const GENERATED_DIR = join(ROOT, 'generated');

function findFrontierCompiler() {
  const candidates = [
    process.env.FRONTIER_COMPILER,
    join(FRONTIER_HOME, 'target', 'release', 'frontier'),
    join(ROOT, 'vendor', 'frontier-syntax', 'target', 'release', 'frontier'),
    'frontier'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        if (existsSync(candidate)) return candidate;
      } else {
        execSync(`command -v ${candidate}`, { stdio: 'ignore' });
        return candidate;
      }
    } catch {}
  }
  return null;
}

function compileFrontier(sourceFile, outputFile, { target, timeout = 180000 } = {}) {
  const compiler = findFrontierCompiler();
  if (!compiler) {
    return { ok: false, error: 'Frontier compiler not found', hint: 'Set FRONTIER_HOME or build frontier-syntax' };
  }

  const targetFlag = target ? ` --target ${target}` : '';
  try {
    execSync(`"${compiler}" compile "${sourceFile}"${targetFlag} -o "${outputFile}"`, {
      stdio: 'pipe',
      timeout
    });
    return { ok: true, output: outputFile, compiler };
  } catch (e) {
    return {
      ok: false,
      error: 'Frontier compile failed',
      detail: e.stderr?.toString() || e.message
    };
  }
}

function slugify(text) {
  return (text || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'unnamed';
}

module.exports = {
  ROOT,
  FRONTIER_HOME,
  GENERATED_DIR,
  findFrontierCompiler,
  compileFrontier,
  slugify
};
