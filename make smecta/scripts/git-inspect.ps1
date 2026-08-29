$git = 'C:\Users\Administrator\Desktop\badi-project\.git'

Write-Output '=== REFLOG (commit history) ==='
if (Test-Path "$git\logs\HEAD") { Get-Content "$git\logs\HEAD" } else { Write-Output '(no logs/HEAD)' }

Write-Output ''
Write-Output '=== REFS ==='
if (Test-Path "$git\packed-refs") { Get-Content "$git\packed-refs" }
Get-ChildItem "$git\refs" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Output ("{0}: {1}" -f $_.FullName.Replace($git,''), (Get-Content $_.FullName -Raw).Trim())
}

Write-Output ''
Write-Output '=== OBJECT STORE ==='
$objects = Get-ChildItem "$git\objects" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'pack' }
Write-Output ("Loose objects: {0}" -f $objects.Count)
$packs = Get-ChildItem "$git\objects\pack" -File -ErrorAction SilentlyContinue
Write-Output ("Pack files: {0}" -f $packs.Count)
$packs | ForEach-Object { Write-Output ("  " + $_.Name + " (" + $_.Length + " bytes)") }

Write-Output ''
Write-Output '=== INDEX entries (tracked files) ==='
# The index is binary; scan it for readable path strings instead.
$idx = "$git\index"
if (Test-Path $idx) {
  $bytes = [System.IO.File]::ReadAllBytes($idx)
  $text = [System.Text.Encoding]::ASCII.GetString($bytes)
  $matches = [regex]::Matches($text, '[A-Za-z0-9_\-./]{3,}')
  $paths = $matches | ForEach-Object { $_.Value } | Where-Object { $_ -match '\.|/' } | Sort-Object -Unique
  $paths | ForEach-Object { Write-Output $_ }
}
