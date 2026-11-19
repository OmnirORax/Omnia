"""Deploy a tested canonical bundle, retaining the existing Access authorization mode."""
import json
import os
from pathlib import Path
import sys
import urllib.request
import uuid

base='https://api.supabase.com/v1/projects/tqjjcabekjjmmspttbli/functions'
headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN']}
existing=json.load(urllib.request.urlopen(urllib.request.Request(base+'/site-draft',headers=headers)))
if existing.get('verify_jwt') is not False:
    raise SystemExit('Unexpected function JWT configuration; deployment stopped.')
source=Path(sys.argv[1]).read_bytes()
boundary='omnia_'+uuid.uuid4().hex
metadata=json.dumps({'name':'site-draft','entrypoint_path':'index.ts','verify_jwt':False}).encode()
body=(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'.encode()+metadata+
      f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n'.encode()+source+f'\r\n--{boundary}--\r\n'.encode())
request=urllib.request.Request(base+'/deploy?slug=site-draft',data=body,headers={**headers,'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
with urllib.request.urlopen(request,timeout=120) as response:
    result=json.load(response)
print(json.dumps({key:result.get(key) for key in ['slug','version','status','verify_jwt']}))
