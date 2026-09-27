"""Configure only this deployment; never print credential values."""
import json
from pathlib import Path

path = Path('deployment/qm.config.jsonc')
config = json.loads(path.read_text())
values = dict(line.split('=', 1) for line in Path('deployment/.env').read_text().splitlines()
              if line and not line.startswith('#') and '=' in line)
if values.get('OPENAI_API_KEY', '').strip():
    config['modelProvider'] = 'openai'
    config['model'] = 'gpt-6-sol'
else:
    raise SystemExit('Add OPENAI_API_KEY to deployment/.env for the selected GPT-6 Sol model; never paste it in chat.')
path.write_text(json.dumps(config, indent=2) + '\n')
print('Configured provider:', config['modelProvider'], 'model:', config.get('model', 'QM provider default'))
