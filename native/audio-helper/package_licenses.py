"""Ship installed dependency license texts with the standalone helper ZIP."""
from importlib import metadata
from pathlib import Path
import re

packages = {'websockets', 'pyaudiowpatch', 'pycaw', 'comtypes', 'pyinstaller',
            'altgraph', 'packaging', 'pyinstaller-hooks-contrib', 'pefile', 'pywin32-ctypes'}
root = Path(__file__).parent / 'dist' / 'ThirdPartyLicenses'
for distribution in metadata.distributions():
    name = distribution.metadata['Name']
    if name.lower() not in packages:
        continue
    destination = root / re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    for file in distribution.files or []:
        if any(word in file.name.lower() for word in ['license', 'copying', 'copyright']):
            source = Path(distribution.locate_file(file))
            if source.is_file():
                destination.mkdir(parents=True, exist_ok=True)
                (destination / file.name).write_bytes(source.read_bytes())
