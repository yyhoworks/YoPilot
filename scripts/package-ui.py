"""Package reviewed static files, not an OxiDNS executable or operator config."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'web-assets.json').read_text(encoding='utf-8'))
names = manifest['files'] + ['web-assets.json']
if len(set(names)) != len(names):
    raise ValueError('Duplicate manifest path')
output = root / 'dist' / ('yopilot-webui-v' + manifest['version'] + '.zip')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        candidate = root / name
        if '..' in Path(name).parts or candidate.is_symlink() or not candidate.resolve().is_relative_to(root) or not candidate.is_file():
            raise ValueError('Invalid static asset: ' + name)
        archive.write(candidate, name)
print('STATIC_PACKAGE:', output.name)
print('FILES:', len(names))
print('SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
