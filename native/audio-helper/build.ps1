$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
python -m pip install -r requirements.txt pyinstaller==6.16.0
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
python -m PyInstaller --clean --noconfirm --onefile --console --name Omnium-Audio-Helper --collect-all pycaw --collect-all comtypes bridge.py
if ($LASTEXITCODE -ne 0) { throw 'Helper build failed' }
Copy-Item THIRD_PARTY_LICENSES.txt dist/
Copy-Item README.md dist/
python package_licenses.py
if ($LASTEXITCODE -ne 0) { throw 'Dependency license packaging failed' }
Compress-Archive -Force -Path dist/Omnium-Audio-Helper.exe,dist/THIRD_PARTY_LICENSES.txt,dist/README.md,dist/ThirdPartyLicenses -DestinationPath dist/Omnium-Audio-Helper-Windows.zip
