"""Generate project-local secrets only when their durable state is new."""
from pathlib import Path
import secrets
import subprocess

def volume_exists(name):
    return subprocess.run(['docker', 'volume', 'inspect', name], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0

root_env = Path('.env')
if not root_env.exists():
    if volume_exists('qm-motion-support_brain-db'):
        raise SystemExit('Restore .env from your private backup; the existing GBrain database must retain its password.')
    root_env.write_text('GBRAIN_DB_PASSWORD=' + secrets.token_hex(32) + '\n')
    root_env.chmod(0o600)

path = Path('deployment/.env')
if not path.exists():
    if volume_exists('qm-qm-motion-coredata'):
        raise SystemExit('Restore deployment/.env before booting an existing QM deployment.')
    values = {name: secrets.token_hex(32) for name in [
        'CAPABILITY_SECRET', 'CONNECTOR_SECRET_KEY', 'CORE_SIGNING_SECRET',
        'PORTAL_IDENTITY_SECRET', 'SKILL_SIGNING_SECRET', 'PORTAL_SESSION_SECRET',
        'AUTH_TOKEN_SECRET', 'AUTH_CLIENT_SECRET']}
    values['AUTH_SIGNING_JWK'] = subprocess.check_output(['node', '-e',
        "console.log(JSON.stringify(require('node:crypto').generateKeyPairSync('ec',{namedCurve:'P-256'}).privateKey.export({format:'jwk'})))"], text=True).strip()
    values['ADMIN_GRANTS'] = 'charlieconner04@gmail.com:org_admin'
    values['AUTH_ALLOWED_EMAILS'] = 'charlieconner04@gmail.com'
    values['PUBLIC_API_URL'] = 'http://qm-qm-motion-core:8080'
    values['OPENAI_API_KEY'] = ''
    path.write_text(''.join(f'{k}={v}\n' for k, v in values.items()))
    path.chmod(0o600)
print('Project-local environment files exist; credential values were not printed.')
