#!/usr/bin/env python3
"""Log a meal Lorne told Mini Lorne about, with estimated carbs and a goal verdict (thumbs up/down).
Usage:
  log_meal.py <meals.json> [more meals.json copies...] --goals <goals.json> --description "..." [--at ISO] [--item "food|grams|source"]... [--trigger "seed oils"]... [--via voice|app]
  log_meal.py ... --carbs-only   --description "..." --item ...      # report carbs + verdict, save nothing
  log_meal.py ... --update-id ID --item ...                          # attach carbs/verdict to an existing meal
Source = URL or 'estimate'. Rules come from goals.json mealRules (defaults: maxCarbsPerMealG 30, maxMealsPerDay 2,
inflammatoryTriggers ['seed oils']). Thumbs down if any --trigger, OR carbs > max, OR meal # > max that NY day.
Every meals.json copy is written identically (first file is the base). Commit/push the data repo yourself.
Prints JSON {id, at, carbsG, inflammatory, verdict, verdictReason, saved}."""
import json, sys, argparse, secrets, datetime as dt
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')
DEFAULT_RULES = {'maxCarbsPerMealG': 30, 'maxMealsPerDay': 2, 'inflammatoryTriggers': ['seed oils']}

def parse_at(s):
    if not s: return dt.datetime.now(NY).replace(microsecond=0)
    t = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    return t if t.tzinfo else t.replace(tzinfo=NY)          # naive = Lorne's local time

def to_dt(s): return parse_at(s).astimezone(NY)

def parse_item(s):
    p = [x.strip() for x in s.split('|')]
    if len(p) < 2 or not p[0]: sys.exit(f'bad --item {s!r}; use "food|grams|source"')
    try: g = float(p[1])
    except ValueError: sys.exit(f'bad grams in --item {s!r}')
    g = int(g) if g == int(g) else round(g, 1)
    return {'food': p[0], 'carbsG': g, 'source': (p[2] if len(p) > 2 and p[2] else 'estimate')}

def rules_from(path):
    r = dict(DEFAULT_RULES)
    if path:
        try: r.update({k: v for k, v in (json.load(open(path)).get('mealRules') or {}).items() if k in DEFAULT_RULES and v is not None})
        except FileNotFoundError: pass
    return r

def ordinal(entries, at, skip_id=None):
    """1-based position of a meal at `at` among meals on the same NY day (counting itself)."""
    day = at.astimezone(NY).date()
    return 1 + sum(1 for e in entries if e.get('id') != skip_id and to_dt(e['at']).date() == day and to_dt(e['at']) < at)

def verdict(carbs, n, R, today=True, infl=()):
    mx, mm = R['maxCarbsPerMealG'], R['maxMealsPerDay']; bad = []; d = 'today' if today else 'that day'
    if infl: bad.append(f"contains {', '.join(infl)} (inflammatory, hurts mobility)")
    if carbs is not None and carbs > mx: bad.append(f'~{carbs:g} g carbs is over your {mx:g} g per-meal limit')
    if n > mm: bad.append(f'meal #{n} {d}; the goal is at most {mm} a day')
    if bad: s = '; '.join(bad) + '.'; return 'down', s[0].upper() + s[1:]
    c = f'~{carbs:g} g carbs (limit {mx:g} g)' if carbs is not None else 'Carbs not checked'
    return 'up', f'{c}, meal {n} of {mm} {d}. Supports blood sugar.'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+', help='meals.json copies (store, repo)')
    ap.add_argument('--goals', help='goals.json (for mealRules)')
    ap.add_argument('--description'); ap.add_argument('--at'); ap.add_argument('--item', action='append', default=[])
    ap.add_argument('--trigger', action='append', default=[], help="inflammatory trigger present, e.g. 'seed oils' (must be in mealRules.inflammatoryTriggers)")
    ap.add_argument('--via', choices=['voice', 'app'], default='voice')
    g = ap.add_mutually_exclusive_group(); g.add_argument('--carbs-only', action='store_true'); g.add_argument('--update-id')
    a = ap.parse_args()
    R = rules_from(a.goals); items = [parse_item(s) for s in a.item]
    known = {t.lower(): t for t in R['inflammatoryTriggers']}; trig = []
    for t in a.trigger:
        if t.strip().lower() not in known: sys.exit(f"unknown --trigger {t!r}; mealRules.inflammatoryTriggers = {R['inflammatoryTriggers']}")
        if known[t.strip().lower()] not in trig: trig.append(known[t.strip().lower()])
    carbs = None
    if items:
        carbs = sum(i['carbsG'] for i in items); carbs = int(carbs) if carbs == int(carbs) else round(carbs, 1)
    base = json.load(open(a.files[0])); base.setdefault('entries', []); base.setdefault('mealOptions', []); base.setdefault('schemaVersion', 1)
    if a.update_id:
        m = [e for e in base['entries'] if e.get('id') == a.update_id]
        if len(m) != 1: sys.exit(f'no meal with id {a.update_id}')
        e = m[0]
        if not items and not trig: sys.exit('--update-id needs at least one --item or --trigger')
        if a.description: e['description'] = a.description
        if a.at: e['at'] = parse_at(a.at).isoformat()
        n = ordinal(base['entries'], to_dt(e['at']), e['id'])
        if items: e['carbsG'] = carbs; e['carbItems'] = items
        if trig: e['inflammatory'] = trig
    else:
        if not a.description and not a.carbs_only: sys.exit('--description is required')
        at = parse_at(a.at); n = ordinal(base['entries'], at)
        e = {'id': secrets.token_hex(4), 'at': at.isoformat(), 'description': (a.description or '').strip()}
        if items: e['carbsG'] = carbs; e['carbItems'] = items
        if trig: e['inflammatory'] = trig
        e['loggedVia'] = a.via
    v, why = verdict(e.get('carbsG'), n, R, to_dt(e['at']).date() == dt.datetime.now(NY).date(), e.get('inflammatory') or []); e['verdict'] = v; e['verdictReason'] = why
    out = {'id': e['id'], 'at': e['at'], 'carbsG': e.get('carbsG'), 'inflammatory': e.get('inflammatory', []), 'verdict': v, 'verdictReason': why}
    if a.carbs_only: out['saved'] = False; print(json.dumps(out)); return
    if not a.update_id: base['entries'].append(e)
    txt = json.dumps(base, indent=2, ensure_ascii=False) + '\n'
    for f in a.files: open(f, 'w').write(txt)
    out['saved'] = True; print(json.dumps(out))

if __name__ == '__main__': main()
