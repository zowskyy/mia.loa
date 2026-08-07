/*
  Lighthouse Community Package Registry API
*/

const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const REGISTRY_FILE = join(__dirname, '..', 'registry', 'packages.json');
const TEMPLATES_DIR = join(__dirname, '..', 'frontier', 'templates');

function loadRegistry() {
  if (!existsSync(REGISTRY_FILE)) {
    return { packages: {}, stats: { total: 0, categories: {} } };
  }
  return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));
}

function mountPackageRegistryRoutes(app) {
  app.get('/api/packages', (_req, res) => {
    res.json(loadRegistry());
  });

  app.get('/api/packages/:name/download', (req, res) => {
    const templatePath = join(TEMPLATES_DIR, req.params.name, 'app.frontier');
    if (!existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.sendFile(templatePath);
  });

  app.get('/api/packages/:name', (req, res) => {
    const registry = loadRegistry();
    const pkg = registry.packages?.[req.params.name];
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  });
}

module.exports = { mountPackageRegistryRoutes, loadRegistry };
