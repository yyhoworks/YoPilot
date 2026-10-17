// Read upstream declarative UI metadata in an isolated VM; emit data, not application code.
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
async function read(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'OxiDNS-UI-prototype' } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
(async () => {
  const commit = JSON.parse(await read('https://api.github.com/repos/svenshi/oxidns/commits/main')).sha;
  const base = `https://raw.githubusercontent.com/svenshi/oxidns/${commit}/webui/lib/plugin-definitions/`;
  const names = ['shared', 'server', 'executor', 'matcher', 'provider'];
  const sources = await Promise.all(names.map(name => read(base + name + '.ts')));
  const code = sources.map(source => stripTypeScriptTypes(source)
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*/gm, '')
    .replace(/\bexport\s+(?=const|function)/g, '')).join('\n');
  const definitions = vm.runInNewContext(code + '\nJSON.stringify([...serverPluginDefinitions,...executorPluginDefinitions,...matcherPluginDefinitions,...providerPluginDefinitions])', {}, {
    timeout: 3000, contextCodeGeneration: { strings: false, wasm: false }
  });
  process.stdout.write(JSON.stringify({ repository: 'svenshi/oxidns', commit, license: 'GPL-3.0-or-later', definitions: JSON.parse(definitions) }));
})().catch(error => { console.error(error.message); process.exit(1); });
