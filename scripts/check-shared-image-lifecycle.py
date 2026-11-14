"""Check the migration in an isolated schema, then roll back every change."""
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import uuid

root = Path(__file__).resolve().parent.parent
schema = 'image_check_' + uuid.uuid4().hex
migration = (root / 'supabase/migrations/20261114000100_shared_image_lifecycle.sql').read_text()
fixture = (root / 'tests/shared-image-lifecycle.sql').read_text()
setup = f'''begin; create schema {schema}; set local search_path={schema};
create table omnium_site_draft(id integer primary key, revision bigint not null, world jsonb not null, previous_world jsonb, updated_at timestamptz default now());
create table omnium_draft_assets(id text primary key,name text not null,type text not null,data text not null,size integer not null check(size>0 and size<=10485760));
'''
query = setup + migration.replace('public.', schema + '.').replace('search_path=public', 'search_path=' + schema) + fixture + '\nrollback;'
request = urllib.request.Request(
    'https://api.supabase.com/v1/projects/tqjjcabekjjmmspttbli/database/query',
    data=json.dumps({'query': query}).encode(),
    headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'},
)
try:
    with urllib.request.urlopen(request, timeout=45) as response:
        print(json.dumps(json.load(response)))
except urllib.error.HTTPError as error:
    raise SystemExit(error.read().decode()) from None
