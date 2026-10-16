#!/usr/bin/env python3
"""Complete a to-do (same rules as the app, incl. recurring spawn).
Usage: complete.py <todos.json> [more copies...] --id ID | --title "substring"   [--reopen | --catch-up]
--catch-up: overdue recurring item -> complete with skippedCount, one new copy due on first occurrence >= today.
Edits each file in place (e.g. the store copy and the repo clone); commit/push the repo yourself.
Recurring: marks complete, creates one new open copy with the next due date; never spawns twice (spawnedNext)."""
import json, sys, argparse, secrets, calendar, datetime as dt
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')
def now(): return dt.datetime.now(NY).isoformat(timespec='seconds')
def next_due(rc, due):
    base = dt.date.fromisoformat(due) if due else dt.datetime.now(NY).date()
    n = max(1, int(rc.get('interval') or 1)); t = rc['type']
    if t == 'daily': return (base + dt.timedelta(days=n)).isoformat()
    if t == 'weekly':
        w = rc.get('weekday'); w = (base.isoweekday() % 7) if w is None else int(w)   # 0=Sunday like JS
        d = base + dt.timedelta(days=1)
        while d.isoweekday() % 7 != w: d += dt.timedelta(days=1)
        return (d + dt.timedelta(days=7 * (n - 1))).isoformat()
    if t == 'monthly':
        md = int(rc.get('monthDay') or base.day); m0 = base.month - 1 + n; y = base.year + m0 // 12; m = m0 % 12 + 1
        return dt.date(y, m, min(md, calendar.monthrange(y, m)[1])).isoformat()
    if t == 'yearly':
        y = base.year + n; return dt.date(y, base.month, min(base.day, calendar.monthrange(y, base.month)[1])).isoformat()
def complete(d, x, nid):
    x['status'] = 'complete'; x['updated'] = now()
    rc = x.get('recurrence')
    if not rc or x.get('spawnedNext'): return None
    c = {'id': nid, 'title': x['title'], 'list': x.get('list', 'Inbox'), 'steps': list(x.get('steps') or []), 'status': 'open',
         'recurrence': dict(rc), 'due': next_due(rc, x.get('due')), 'added': now(), 'updated': now(), 'spawnedFrom': x['id']}
    if x.get('assignee'): c['assignee'] = x['assignee']
    if x.get('dueTime'): c['dueTime'] = x['dueTime']
    d['todos'].append(c); x['spawnedNext'] = nid; return c
def catch_up(d, x, nid):
    today = dt.datetime.now(NY).date().isoformat(); rc = x.get('recurrence')
    if not rc or not x.get('due') or x['due'] >= today or x.get('spawnedNext'): sys.exit('not an overdue recurring item (or already spawned)')
    nd, skipped = x['due'], 0
    while nd < today: skipped += 1; nd = next_due(rc, nd)
    c = complete(d, x, nid); x['skippedCount'] = skipped; c['due'] = nd; return c
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--id'); g.add_argument('--title'); ap.add_argument('--reopen', action='store_true'); ap.add_argument('--catch-up', action='store_true'); a = ap.parse_args()
    nid = secrets.token_hex(4)
    for f in a.files:
        d = json.load(open(f))
        m = [t for t in d['todos'] if (t['id'] == a.id if a.id else a.title.lower() in t['title'].lower()) and (a.reopen or t.get('status') != 'complete')]
        if len(m) != 1: sys.exit(f"{f}: expected 1 match, found {len(m)}: {[t['title'] for t in m]}")
        x = m[0]
        if a.reopen: x['status'] = 'open'; x['updated'] = now(); new = None
        elif a.catch_up: new = catch_up(d, x, nid)
        else: new = complete(d, x, nid)
        d['schemaVersion'] = max(4, d.get('schemaVersion', 1)); d['updated'] = now()
        open(f, 'w').write(json.dumps(d, indent=2) + '\n')
        print(f"{f}: {'reopened' if a.reopen else 'completed'} {x['id']} '{x['title']}'" + (f"; next {new['id']} due {new['due']}" if new else ''))
if __name__ == '__main__': main()
