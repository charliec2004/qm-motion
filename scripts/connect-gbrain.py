"""Give the single QM demo computer its scoped OAuth client, never DB access."""
import json
from pathlib import Path
import re
import subprocess

subprocess.run(['python3', 'scripts/computer.py', '--connect'], check=True)
name = subprocess.check_output(['python3', 'scripts/computer.py', '--name'], text=True).strip()
existing = subprocess.run(['docker', 'exec', name, 'test', '-s', '/root/.gbrain/config.json']).returncode == 0
if not existing:
    text = Path('.state/gbrain-client.txt').read_text()
    client_id = re.search(r'Client ID:\s+(\S+)', text).group(1)
    client_secret = re.search(r'Client Secret:\s+(\S+)', text).group(1)
    script = '''import json,subprocess,sys
v=json.load(sys.stdin)
r=subprocess.run(["/usr/local/bin/gbrain","init","--mcp-only","--non-interactive",
"--issuer-url","https://gbrain.qm.internal:3443","--mcp-url","https://gbrain.qm.internal:3443/mcp",
"--oauth-client-id",v["id"],"--oauth-client-secret",v["secret"]],capture_output=True,text=True)
if r.returncode:
 print(r.stderr.replace(v["secret"],"[redacted]"),file=sys.stderr)
sys.exit(r.returncode)
'''
    subprocess.run(['docker', 'exec', '-i', name, 'python3', '-c', script],
                   input=json.dumps({'id': client_id, 'secret': client_secret}), text=True, check=True)
subprocess.run(['docker', 'exec', name, 'gbrain', 'whoami'], check=True)
