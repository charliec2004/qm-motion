import os
from pathlib import Path
import re
import subprocess
import tempfile

prefix = ['docker', 'compose', '--env-file', '.env', '-f', 'deployment/compose.yaml', 'exec', '-T', 'gbrain', 'gbrain']
result = subprocess.run(prefix + ['sources', 'list', '--json'], check=True, capture_output=True, text=True)
if 'qm-motion' not in result.stdout:
    subprocess.run(prefix + ['sources', 'add', 'qm-motion'], check=True)
credentials = Path('.state/gbrain-client.txt')
if not credentials.exists():
    with tempfile.NamedTemporaryFile(mode='w+', dir=credentials.parent) as output:
        subprocess.run(prefix + ['auth', 'register-client', 'qm-motion-demo', '--grant-types',
            'client_credentials', '--scopes', 'read write', '--source', 'qm-motion',
            '--federated-read', 'qm-motion', '--bound-slug-prefixes', 'cases/'], check=True, stdout=output)
        output.seek(0)
        content = output.read()
        if not all(re.search(pattern, content) for pattern in [r'Client ID:\s+\S+', r'Client Secret:\s+\S+']):
            raise SystemExit('Client registration did not return complete credentials; inspect server client state before retrying.')
        # Atomically publish the validated mode-600 file without overwriting
        # an existing credential file. Temporary-name cleanup retains this link.
        os.link(output.name, credentials)
else:
    content = credentials.read_text()
    if not all(re.search(pattern, content) for pattern in [r'Client ID:\s+\S+', r'Client Secret:\s+\S+']):
        raise SystemExit('Scoped client credential file is incomplete. Restore its private backup; do not recreate the database.')
print('GBrain project source and scoped client provisioned.')
