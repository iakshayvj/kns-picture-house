#!/usr/bin/env python3
"""KNS Picture House enrichment pipeline.
Sources: IMDb suggestion API + Cinemeta (IMDb rating), Wikipedia (plot/country/language/poster),
Rotten Tomatoes (tomatometer), JustWatch GraphQL (India streaming)."""
import json, re, time, subprocess, sys, urllib.parse, html as htmllib

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

def get(url, ctype=None, data=None, timeout=25):
    cmd = ['curl','-s','--max-time',str(timeout),'-H',f'User-Agent: {UA}','-H','Accept-Language: en-US,en;q=0.9']
    if data is not None:
        cmd += ['-X','POST','-H',f'Content-Type: {ctype or "application/json"}','-d',data]
    cmd.append(url)
    return subprocess.run(cmd, capture_output=True, text=True).stdout

FILMS = [
  {"id":"robot-dreams-2023","q":"Robot Dreams","year":2023,"wiki":"Robot_Dreams_(film)","rt":["robot_dreams"]},
  {"id":"wicker-2026","q":"Wicker","year":2026,"wiki":"Wicker_(film)","rt":["wicker","wicker_2026"]},
  {"id":"fjord-2026","q":"Fjord","year":2026,"wiki":"Fjord_(film)","rt":["fjord","fjord_2026"]},
  {"id":"brooklyn-2015","q":"Brooklyn","year":2015,"wiki":"Brooklyn_(film)","rt":["brooklyn_2015","brooklyn"]},
  {"id":"the-ballad-of-wallis-island-2025","q":"The Ballad of Wallis Island","year":2025,"wiki":"The_Ballad_of_Wallis_Island","rt":["the_ballad_of_wallis_island"]},
  {"id":"parallel-tales-2026","q":"Parallel Tales","year":2026,"wiki":"Parallel_Tales","rt":["parallel_tales","parallel_tales_2026"]},
  {"id":"parallel-mothers-2021","q":"Parallel Mothers","year":2021,"wiki":"Parallel_Mothers","rt":["parallel_mothers"]},
  {"id":"boiling-point-2021","q":"Boiling Point","year":2021,"wiki":"Boiling_Point_(2021_film)","rt":["boiling_point_2021","boiling_point"]},
  {"id":"our-girls-2025","q":"Our Girls","year":2025,"wiki":"Our_Girls","rt":["our_girls","our_girls_2025","voor_de_meisjes"]},
  {"id":"agas-house-2019","q":"Aga's House","year":2019,"wiki":"Aga%27s_House","rt":["agas_house","aga_s_house"]},
  {"id":"sob-pressao-2016","q":"Under Pressure Sob Pressao","year":2016,"wiki":"Sob_Press%C3%A3o","rt":["sob_pressao","under_pressure_2016"]},
]

def imdb_id(query, year):
    slug = query.lower().replace(' ','_').replace("'",'')
    first = slug[0]
    raw = get(f'https://v2.sg.media-imdb.com/suggestion/{first}/{urllib.parse.quote(slug)}.json')
    try: d = json.loads(raw)
    except: return None, None
    best = None
    for it in d.get('d', []):
        if it.get('qid') not in ('movie','tvMovie'): continue
        y = it.get('y')
        score = abs((y or 0) - year)
        if best is None or score < best[0]:
            best = (score, it)
    if best and best[0] <= 1:
        return best[1]['id'], (best[1].get('i') or {}).get('imageUrl')
    return (d.get('d',[None])[0] or {}).get('id'), None

def cinemeta(ttid):
    if not ttid: return {}
    try:
        d = json.loads(get(f'https://v3-cinemeta.strem.io/meta/movie/{ttid}.json'))
        return d.get('meta') or {}
    except: return {}

def wiki_extract(wiki):
    raw = get(f'https://en.wikipedia.org/wiki/{wiki}')
    if not raw: return {}
    out = {}
    paras = re.findall(r'<p>(.*?)</p>', raw, re.S)
    for p in paras:
        t = htmllib.unescape(re.sub(r'<[^>]+>','',p)).strip()
        if len(t) > 80:
            out['first_para'] = re.sub(r'\[\d+\]','',t); break
    m = re.search(r'class="infobox-image[^"]*"[^>]*>.*?src="([^"]+)"', raw, re.S)
    if m: out['poster'] = 'https:' + m.group(1).replace('&amp;','&')
    txt = htmllib.unescape(re.sub(r'<[^>]+>',' ',raw))
    m = re.search(r'Rotten Tomatoes[^%]{0,200}?(\d{1,3})%', txt)
    if m: out['rt_in_wiki'] = int(m.group(1))
    # infobox country/language
    for field,label in [('country','Countries'),('language','Languages')]:
        m = re.search(label + r'</th>.*?<td[^>]*>(.*?)</td>', raw, re.S)
        if m:
            vals = re.findall(r'>([^<>{}]+)<', m.group(1))
            out[field] = ', '.join(v.strip() for v in vals if v.strip() and not v.strip().startswith('['))[:120]
    return out

def rt_score(slugs, title):
    for slug in slugs:
        raw = get(f'https://www.rottentomatoes.com/m/{slug}')
        if not raw or '<title>' not in raw: continue
        m = re.search(r'<title>(.*?)\|', raw)
        page_title = m.group(1).strip() if m else ''
        if not any(w.lower() in page_title.lower() for w in title.split()[:2]): continue
        m2 = re.search(r'<rt-text slot="critics-score"[^>]*>(\d+)%</rt-text>', raw)
        if m2: return int(m2.group(1)), page_title
        return None, page_title  # page exists but no score yet
    return None, None

def jw_offers(query, title, year):
    q = {"query":"query S($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) { popularTitles(country: $country, first: $first, filter: $filter) { edges { node { objectType offers(country: $country, platform: WEB) { monetizationType package { clearName } } content(country: $country, language: $language) { title fullPath } } } } }",
         "variables":{"country":"IN","language":"en","first":5,"filter":{"searchQuery":query}}}
    try:
        d = json.loads(get('https://apis.justwatch.com/graphql', data=json.dumps(q)))
        edges = d['data']['popularTitles']['edges']
    except Exception as e:
        return {'error': str(e)}
    for e in edges:
        n = e['node']
        if n['objectType'] != 'MOVIE': continue
        t = n['content']['title'].lower()
        if t == title.lower() or title.lower() in t or t in title.lower():
            out = {}
            for o in n.get('offers') or []:
                kind = o['monetizationType']; name = o['package']['clearName']
                out.setdefault(kind, [])
                if name not in out[kind]: out[kind].append(name)
            return {'path': 'https://www.justwatch.com' + n['content']['fullPath'], 'offers': out}
    return {'path': None, 'offers': {}}

results = {}
for f in FILMS:
    print('---', f['q'], flush=True)
    r = {'id': f['id'], 'year': f['year']}
    ttid, imdb_img = imdb_id(f['q'], f['year'])
    r['imdb_id'] = ttid; r['imdb_img'] = imdb_img
    time.sleep(0.4)
    cm = cinemeta(ttid)
    r['imdb'] = cm.get('imdbRating')
    r['cm_desc'] = cm.get('description')
    r['cm_genres'] = cm.get('genre') or cm.get('genres')
    r['cm_runtime'] = cm.get('runtime')
    r['cm_country'] = cm.get('country')
    time.sleep(0.4)
    w = wiki_extract(f['wiki'])
    r['wiki'] = w
    time.sleep(1.2)
    rt, rt_title = rt_score(f['rt'], f['q'])
    r['rt'] = rt if rt is not None else w.get('rt_in_wiki')
    r['rt_page'] = rt_title
    time.sleep(1.2)
    r['jw'] = jw_offers(f['q'].replace(' Sob Pressao',''), f['q'].replace(' Sob Pressao',''), f['year'])
    results[f['id']] = r
    time.sleep(0.8)

json.dump(results, open('data/enriched.json','w'), indent=2)
print('DONE', len(results))
