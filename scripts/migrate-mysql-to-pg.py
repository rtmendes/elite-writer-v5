#!/usr/bin/env python3
"""MySQL -> Postgres data copy for elite_writer. Row counts verified per table.
Connections from env: MYSQL_URL, PG_URL. Never prints credentials."""
import os, sys, json
from urllib.parse import urlparse, unquote

import pymysql
import psycopg

my = urlparse(os.environ["MYSQL_URL"])
mconn = pymysql.connect(
    host=my.hostname, port=my.port or 3306, user=unquote(my.username),
    password=unquote(my.password), database=my.path.lstrip("/"), charset="utf8mb4",
)
pconn = psycopg.connect(os.environ["PG_URL"], autocommit=False)

SKIP = {"__drizzle_migrations"}

pcur = pconn.cursor()
pcur.execute("""SELECT table_name FROM information_schema.tables
                WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name""")
tables = [r[0] for r in pcur.fetchall() if r[0] not in SKIP]
print(f"target tables: {len(tables)}")

# target column types per table (case-preserved names); track generated cols (cannot INSERT)
coltypes = {}
generated = {}
for t in tables:
    pcur.execute("""SELECT column_name, data_type, is_generated FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=%s""", (t,))
    rows = pcur.fetchall()
    coltypes[t] = {r[0]: r[1] for r in rows}
    generated[t] = {r[0] for r in rows if r[2] == "ALWAYS"}

# idempotent rerun: clear all targets first (no FKs in schema)
for t in tables:
    pcur.execute(f'TRUNCATE TABLE "{t}"')
pconn.commit()
print("targets truncated")

mcur = mconn.cursor()
copied = {}
for t in tables:
    mcur.execute(f"SELECT COUNT(*) FROM `{t}`")
    n = mcur.fetchone()[0]
    if n == 0:
        copied[t] = 0
        continue
    mcur.execute(f"SELECT * FROM `{t}`")
    allcols = [d[0] for d in mcur.description]
    types = coltypes[t]
    # PG generated columns (e.g. wsRows.dbId) recompute themselves — skip on insert
    skipped = [c for c in allcols if c in generated[t]]
    if skipped:
        print(f"{t}: skipping generated column(s) {skipped}")
    cols = [c for c in allcols if c not in generated[t]]
    missing = [c for c in cols if c not in types]
    if missing:
        print(f"FATAL {t}: columns missing in Postgres: {missing}")
        sys.exit(1)
    ph = []
    for c in cols:
        dt = types[c]
        if dt == "jsonb":
            ph.append("%s::jsonb")
        elif dt == "boolean":
            ph.append("%s::int::boolean")
        else:
            ph.append("%s")
    collist = ", ".join(f'"{c}"' for c in cols)
    sql = f'INSERT INTO "{t}" ({collist}) VALUES ({", ".join(ph)})'
    rows = mcur.fetchall()
    fixed = []
    for row in rows:
        vals = []
        for c, v in zip(allcols, row):
            if c in generated[t]:
                continue
            dt = types[c]
            if dt == "boolean" and v is not None:
                v = int(v)
            if dt == "jsonb" and v is not None and not isinstance(v, str):
                v = json.dumps(v)
            vals.append(v)
        fixed.append(tuple(vals))
    pcur.executemany(sql, fixed)
    pconn.commit()
    copied[t] = n

# reset serial sequences where an integer id PK exists
for t in tables:
    if coltypes[t].get("id") == "integer" and copied[t] > 0:
        pcur.execute(
            f"""SELECT setval(pg_get_serial_sequence('"{t}"','id'), (SELECT MAX(id) FROM "{t}"))"""
        )
pconn.commit()

# verify: mysql count vs pg count, every table
print(f"{'table':32} {'mysql':>7} {'pg':>7}  ok")
fail = False
for t in tables:
    mcur.execute(f"SELECT COUNT(*) FROM `{t}`")
    mn = mcur.fetchone()[0]
    pcur.execute(f'SELECT COUNT(*) FROM "{t}"')
    pn = pcur.fetchone()[0]
    ok = mn == pn
    fail |= not ok
    print(f"{t:32} {mn:>7} {pn:>7}  {'OK' if ok else '<<< MISMATCH'}")

# spot checks
pcur.execute('SELECT id, title, status FROM "articles" ORDER BY id LIMIT 1')
print("spot article:", pcur.fetchone())
pcur.execute('SELECT id, title, "riStatus" FROM "research_items" ORDER BY id LIMIT 1')
print("spot research_item:", pcur.fetchone())
pcur.execute('SELECT id, "openId" IS NOT NULL, role FROM "users" ORDER BY id LIMIT 1')
print("spot user:", pcur.fetchone())
pcur.execute("""SELECT last_value FROM pg_sequences WHERE schemaname='public' AND sequencename='articles_id_seq'""")
print("articles seq:", pcur.fetchone())

sys.exit(1 if fail else 0)
