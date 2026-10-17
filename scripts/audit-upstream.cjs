// Read-only comparison against a checked-out upstream tree; does not run OxiDNS.
// Usage: node --disable-warning=ExperimentalWarning scripts/audit-upstream.cjs <upstream-root>
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const upstream = path.resolve(process.argv[2] || 'reference/oxidns');
const project = path.resolve(__dirname, '..');
const local = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(project, 'oxidns-plugin-catalog.js'), 'utf8'), local, { timeout: 3000 });
const snapshot = local.window.OxiCatalog;
const sources = ['shared', 'server', 'executor', 'matcher', 'provider'].map(name =>
  fs.readFileSync(path.join(upstream, 'webui/lib/plugin-definitions', name + '.ts'), 'utf8'));
const code = sources.map(source => stripTypeScriptTypes(source)
  .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*/gm, '')
  .replace(/\bexport\s+(?=const|function)/g, '')).join('\n');
const official = JSON.parse(vm.runInNewContext(code + '\nJSON.stringify([...serverPluginDefinitions,...executorPluginDefinitions,...matcherPluginDefinitions,...providerPluginDefinitions])', {}, {
  timeout: 3000, contextCodeGeneration: { strings: false, wasm: false }
}));
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item =>
    item.isDirectory() ? files(path.join(dir, item.name)) : [path.join(dir, item.name)]);
}
const registrations = [];
for (const file of files(path.join(upstream, 'src/plugin')).filter(file => file.endsWith('.rs'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^(?:#\[plugin_factory\("([^"\n]+)"\)\]|register_plugin_factory!\("([^"\n]+)")/gm)) {
    const relative = path.relative(upstream, file).replaceAll('\\', '/');
    registrations.push({ kind: match[1] || match[2], category: relative.split('/')[2], file: relative,
      line: source.slice(0, match.index).split('\n').length });
  }
}
registrations.sort((a, b) => a.kind.localeCompare(b.kind));
const localKinds = new Set(snapshot.definitions.map(item => item.kind));
const backendKinds = new Set(registrations.map(item => item.kind));
const result = {
  commit: execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  snapshotCommit: snapshot.commit,
  backendTypes: backendKinds.size,
  localTypes: localKinds.size,
  categories: Object.fromEntries(['server','executor','matcher','provider'].map(type => [type, {
    backend: registrations.filter(item => item.category === type).length,
    local: snapshot.definitions.filter(item => item.type === type).length
  }])),
  missingFromLocal: [...backendKinds].filter(kind => !localKinds.has(kind)),
  absentFromBackend: [...localKinds].filter(kind => !backendKinds.has(kind)),
  changedDefinitions: official.filter(item => JSON.stringify(item) !== JSON.stringify(snapshot.definitions.find(local => local.kind === item.kind))).map(item => item.kind),
  topLevelSchemaFields: official.reduce((count, item) => count + item.configSchema.length, 0),
  registrations
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
