/* Validate the standalone static distribution; no network or DNS writes. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),files=new Set(['index.html','oxidns-console-prototype.html','LICENSE','THIRD_PARTY_NOTICES.md','vendor/LICENSE-js-yaml.txt','assets/fonts/README.md','assets/fonts/manifest.json']);
const safe=name=>{if(path.isAbsolute(name)||name.split(/[\\/]/).includes('..'))throw Error('Unsafe asset: '+name);return name.replaceAll('\\','/');};
function collect(name){name=safe(name);if(files.has(name)&&!name.endsWith('.html'))return;files.add(name);const full=path.join(root,name);if(!fs.existsSync(full))throw Error('Missing asset: '+name);if(!/\.(css|html)$/.test(name))return;const text=fs.readFileSync(full,'utf8');
 const references=name.endsWith('.html')?[...text.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|png|svg|woff2)(?:\?[^"#]*)?)"/g)].map(m=>m[1]):[...text.matchAll(/url\(["']?([^\s)'";]+)["']?\)/g)].map(m=>m[1]);
 for(const reference of references){if(/^(?:https?:|data:|#)/.test(reference))continue;collect(path.posix.join(path.posix.dirname(name),reference.split('?')[0]));}
}
// Start clean so both HTML entrypoints are traversed rather than treated as visited.
files.delete('index.html');files.delete('oxidns-console-prototype.html');collect('index.html');collect('oxidns-console-prototype.html');
for(const name of fs.readdirSync(path.join(root,'assets/yopilot-brand')).filter(n=>n.endsWith('.png')))files.add('assets/yopilot-brand/'+name);
for(const name of fs.readdirSync(path.join(root,'assets/fonts')).filter(n=>n.endsWith('-OFL.txt')))files.add('assets/fonts/'+name);
const list=[...files].sort();for(const name of list)if(!fs.statSync(path.join(root,name)).isFile())throw Error('Not a regular asset: '+name);
if(fs.readFileSync(path.join(root,'index.html'),'utf8')!==fs.readFileSync(path.join(root,'oxidns-console-prototype.html'),'utf8'))throw Error('Entrypoints must match');
const manifestPath=path.join(root,'web-assets.json');
if(process.argv.includes('--write-manifest'))fs.writeFileSync(manifestPath,JSON.stringify({version:'0.1.0',files:list},null,2)+'\n');
else {const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));if(JSON.stringify(manifest.files)!==JSON.stringify(list))throw Error('Asset manifest is stale; review and regenerate it');}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');if(/yopilot-admin\.js/.test(html))throw Error('Legacy backend must not be loaded');
for(const doc of ['README.md','docs/SCREENSHOTS.md'])if(fs.existsSync(path.join(root,doc))){for(const m of fs.readFileSync(path.join(root,doc),'utf8').matchAll(/\]\((docs\/screenshots\/[^)]+|screenshots\/[^)]+)\)/g)){if(!fs.existsSync(path.resolve(root,path.posix.dirname(doc),m[1])))throw Error('Missing documentation screenshot: '+m[1]);}}
console.log('Static assets verified:',list.length,'· manifest version 0.1.0 · no backend bundle');
