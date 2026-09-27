"""Access only computers belonging to this deployment's configured image."""
import json
import subprocess
import sys

def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

ids = subprocess.check_output(['docker', 'ps', '-aq', '--filter', 'label=qm.org=qm-motion'], text=True).split()
computers = []
for cid in ids:
    info = json.loads(subprocess.check_output(['docker', 'inspect', cid]))[0]
    name = info['Name'].lstrip('/')
    if name.startswith('qm-sbx-'):
        computers.append((name, info))
args = sys.argv[1:]
if args == ['--status']:
    for name, info in computers:
        print(name, info['State']['Status'])
    if not computers:
        print('No QM Motion agent computer yet. Ask QM to run a command first.')
elif args == ['--stop']:
    for name, info in computers:
        if info['State']['Running']:
            run('docker', 'stop', name)
elif args == ['--connect']:
    for name, info in computers:
        if not info['State']['Running']:
            run('docker', 'start', name)
        if 'qm-motion-brain-clients' not in info['NetworkSettings']['Networks']:
            run('docker', 'network', 'connect', 'qm-motion-brain-clients', name)
else:
    if len(computers) != 1:
        raise SystemExit(f'Expected one QM Motion computer, found {len(computers)}. Inspect npm run status.')
    if args == ['--name']:
        print(computers[0][0])
    elif args:
        if not computers[0][1]['State']['Running']:
            run('docker', 'start', computers[0][0], stdout=subprocess.DEVNULL)
        run('docker', 'exec', computers[0][0], 'mkdir', '-p', '/root/workspace')
        result = subprocess.run(['docker', 'exec', '-i', '-w', '/root/workspace', computers[0][0], *args])
        sys.exit(result.returncode)
    else:
        raise SystemExit('Usage: npm run computer -- <command> [arguments...]')
