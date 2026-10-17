"""Copy static UI assets to an existing OxiDNS WebUI; never control DNS services."""
import argparse
import datetime
import getpass
import hashlib
import json
from pathlib import Path
import posixpath
import shlex
import paramiko

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--host', required=True, help='Your DNS host; no device address is embedded')
parser.add_argument('--port', type=int, default=22)
parser.add_argument('--user', default='root')
parser.add_argument('--webroot', default='/opt/oxidns/webui')
parser.add_argument('--config', default='/opt/oxidns/config.yaml')
parser.add_argument('--binary', default='/opt/oxidns/oxidns')
parser.add_argument('--api-port', type=int, default=9199)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'web-assets.json').read_text(encoding='utf-8'))
names = manifest['files'] + ['web-assets.json']
web = args.webroot.rstrip('/')
if not web.startswith('/') or posixpath.normpath(web) != web or len(web.split('/')) < 4:
    raise ValueError('Use an explicit absolute WebUI directory, not a broad directory')
if not 1 <= args.api_port <= 65535:
    raise ValueError('Invalid API port')
for name in names:
    p = root / name
    if Path(name).is_absolute() or '..' in Path(name).parts or p.is_symlink() or not p.resolve().is_relative_to(root) or not p.is_file():
        raise ValueError('Unsafe or missing manifest asset: ' + name)
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup, stage = web + '.yopilot-before-' + stamp, web + '.yopilot-stage-' + stamp
q = shlex.quote
client = paramiko.SSHClient()
client.load_system_host_keys()
client.set_missing_host_key_policy(paramiko.RejectPolicy())

def run(command):
    _, stdout, stderr = client.exec_command(command, timeout=30)
    out, err = stdout.read().decode(), stderr.read().decode()
    if stdout.channel.recv_exit_status():
        raise RuntimeError(err or out or command)
    return out.strip()

def fingerprint():
    return (run('sha256sum ' + q(args.config)), run('sha256sum ' + q(args.binary)), run('pidof oxidns'))

try:
    client.connect(args.host, port=args.port, username=args.user, password=getpass.getpass('SSH password (not saved): '), look_for_keys=False, allow_agent=False, timeout=10)
    if run('readlink -f ' + q(web)) != web:
        raise RuntimeError('WebUI is missing or resolves elsewhere; pass its exact real directory')
    before = fingerprint()
    run('curl -fsS http://127.0.0.1:' + str(args.api_port) + '/api/health')
    for destination in [backup, stage]:
        run('test ! -e ' + q(destination))
    run('cp -a ' + q(web) + ' ' + q(backup))
    with client.open_sftp() as sftp:
        # Preserve an original upstream landing page on first installation.
        try:
            sftp.stat(web + '/native.html')
        except FileNotFoundError:
            with sftp.open(web + '/index.html', 'r') as index:
                title = index.read(8192).decode(errors='replace')
            if '<title>YoPilot' not in title:
                run('cp -p ' + q(web + '/index.html') + ' ' + q(web + '/native.html'))
        for directory in sorted({posixpath.dirname(name) for name in names}):
            run('mkdir -p ' + q(stage + ('/' + directory if directory else '')))
            if directory:
                run('mkdir -p ' + q(web + '/' + directory))
        for name in names:
            destination = stage + '/' + name
            sftp.put(str(root / name), destination)
            sftp.chmod(destination, 0o644)
            expected = hashlib.sha256((root / name).read_bytes()).hexdigest()
            if run('sha256sum ' + q(destination)).split()[0] != expected:
                raise RuntimeError('Upload checksum mismatch: ' + name)
        for name in sorted(names, key=lambda n: n.endswith('.html')):
            sftp.posix_rename(stage + '/' + name, web + '/' + name)
    if fingerprint() != before:
        raise RuntimeError('DNS process/config/binary changed; inspect state before retrying')
    run('curl -fsS http://127.0.0.1:' + str(args.api_port) + '/api/health')
    print('STATIC_UI_DEPLOYED:', len(names), 'files')
    print('UI_BACKUP:', backup)
    print('DNS_CONFIG_BINARY_PID_UNCHANGED:', before[2])
    print('Empty staging directories retained at:', stage)
finally:
    client.close()
