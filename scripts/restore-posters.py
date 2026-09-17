#!/usr/bin/env python3
"""Restore site/assets/posters/*.jpg from the deployed/base64 posters-*.js chunks."""
import json, re, base64, glob, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
posters = {}
for f in glob.glob(os.path.join(root, 'site', 'posters-*.js')):
    m = re.search(r'Object\.assign\(window\.KNS_POSTERS, (\{.*\})\);', open(f).read(), re.S)
    posters.update(json.loads(m.group(1)))
db = json.load(open(os.path.join(root, 'data', 'movies.json')))
os.makedirs(os.path.join(root, 'site', 'assets', 'posters'), exist_ok=True)
for mv in db['movies']:
    uri = posters.get(mv['id'])
    if uri:
        open(os.path.join(root, 'site', 'assets', 'posters', mv['id'] + '.jpg'), 'wb').write(base64.b64decode(uri.split(',', 1)[1]))
print(f"restored {len(posters)} posters")
