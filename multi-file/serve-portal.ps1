# Serves the multi-file portal on http://127.0.0.1:<port>/ using HttpListener.
# Bind is localhost only. Called by the start/stop bat files. No typing required.
param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$StateFile = Join-Path $env:TEMP 'milad-portal-server.json'

function Stop-Portal {
  if (Test-Path -LiteralPath $StateFile) {
    try {
      $j = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
      if ($j.pid) { Stop-Process -Id ([int]$j.pid) -Force -ErrorAction SilentlyContinue }
    } catch { }
    Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
  }
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine -like '*serve-portal.ps1*' -and $_.ProcessId -ne $PID } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
}

if ($Stop) { Stop-Portal; exit 0 }

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = (Get-Location).Path }
Set-Location -LiteralPath $Root
if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
  Write-Host 'index.html not found next to this script.'
  Read-Host 'Press Enter to close'
  exit 1
}

Stop-Portal

$ports = 8765, 8770, 8780, 8787, 8888, 8890, 9000, 9010
$listener = $null
$port = $null
foreach ($p in $ports) {
  try {
    $l = New-Object System.Net.HttpListener
    # Loopback only: localhost + 127.0.0.1 (not * or +). Browser opens localhost.
    $l.Prefixes.Add("http://127.0.0.1:$p/")
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start()
    $listener = $l
    $port = $p
    break
  } catch {
    try { if ($l) { $l.Close() } } catch { }
  }
}
if (-not $listener) {
  Write-Host 'Could not open a local port (8765-9010). Close the previous window or double-click the stop file, then try again.'
  Read-Host 'Press Enter to close'
  exit 1
}

@{ pid = $PID; port = $port } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding UTF8
$url = "http://localhost:$port/"
Write-Host ""
Write-Host "Portal is ready:"
Write-Host "  $url"
Write-Host ""
Write-Host "The browser will open by itself."
Write-Host "To stop: close this window, or double-click the stop file."
Write-Host ""

try { Start-Process $url } catch { }

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.txt'  = 'text/plain; charset=utf-8'
  '.map'  = 'application/json'
}

function Get-SafePath([string]$rel) {
  $rel = [uri]::UnescapeDataString($rel)
  $rel = $rel -replace '\\', '/'
  if ($rel -eq '' -or $rel -eq '/') { $rel = 'index.html' }
  $rel = $rel.TrimStart('/')
  if ($rel.Contains('..')) { return $null }
  $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
  $rootFull = [System.IO.Path]::GetFullPath($Root)
  if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
  return $full
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = Get-SafePath $req.Url.AbsolutePath
      if (-not $path) { $res.StatusCode = 400; $res.Close(); continue }
      if (-not (Test-Path -LiteralPath $path)) { $res.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes('Not found'); $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close(); continue }
      if ((Get-Item -LiteralPath $path).PSIsContainer) {
        $idx = Join-Path $path 'index.html'
        if (Test-Path -LiteralPath $idx) { $path = $idx } else { $res.StatusCode = 403; $res.Close(); continue }
      }
      $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
      $ctype = $mime[$ext]
      if (-not $ctype) { $ctype = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.StatusCode = 200
      $res.ContentType = $ctype
      $res.ContentLength64 = $bytes.Length
      $res.Headers['Cache-Control'] = 'no-cache'
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
    } catch {
      try { $res.StatusCode = 500; $res.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop(); $listener.Close() } catch { }
  Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
}
