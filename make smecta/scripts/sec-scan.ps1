$root = 'C:\Users\Administrator\Desktop\badi-project\make smecta'
$patterns = @(
  'sk-[A-Za-z0-9]{20,}',
  'ghp_[A-Za-z0-9]{30,}',
  'AKIA[0-9A-Z]{16}',
  '(?i)firebase',
  '(?i)prisma',
  '(?i)drizzle',
  '(?i)dynamodb',
  'BEGIN (RSA |EC )?PRIVATE KEY',
  'postgres(ql)?://',
  'mysql://',
  'mongodb(\+srv)?://',
  '(?i)password\s*[:=]',
  '(?i)secret\s*[:=]',
  '(?i)api[_-]?key\s*[:=]',
  '(?i)sslmode',
  '(?i)rejectUnauthorized',
  'turnstile.*secret|SECRET.*TURNSTILE',
  '(?i)webhook'
)
$files = Get-ChildItem $root -Recurse -File -Force | Where-Object {
  $_.FullName -notmatch 'node_modules|\\.git\\|\\dist\\|package-lock|\.ps1$'
}
foreach ($f in $files) {
  $hits = Select-String -Path $f.FullName -Pattern $patterns -ErrorAction SilentlyContinue
  foreach ($h in $hits) {
    $line = $h.Line.Trim()
    if ($line.Length -gt 180) { $line = $line.Substring(0,180) + '...' }
    Write-Output ("{0}:{1}: {2}" -f $h.Path.Replace($root,''), $h.LineNumber, $line)
  }
}
