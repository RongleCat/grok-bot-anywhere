import {execFile} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {resolve} from 'node:path';

// Read the foreground Finder or Explorer window only. A background selection stays put.
const finderScript = `tell application "System Events"
  set frontApp to bundle identifier of first application process whose frontmost is true
end tell
if frontApp is not "com.apple.finder" then return ""
tell application "Finder"
  set selectedPaths to {}
  try
    repeat with selectedFile in (selection as alias list)
      set end of selectedPaths to POSIX path of selectedFile
    end repeat
  end try
  set AppleScript's text item delimiters to linefeed
  return selectedPaths as text
end tell`;

const explorerScript = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class GbaForeground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int processId);
}
"@
$hwnd = [GbaForeground]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { exit 0 }
$processId = 0
[void][GbaForeground]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if (-not $process -or $process.ProcessName -ne 'explorer') { exit 0 }
$foreground = [uint32]([int64]$hwnd -band 0xFFFFFFFF)
$shell = New-Object -ComObject Shell.Application
foreach ($explorer in @($shell.Windows())) {
  try {
    $handle = [uint32]([int64]$explorer.HWND -band 0xFFFFFFFF)
    if ($handle -ne $foreground) { continue }
    foreach ($item in @($explorer.Document.SelectedItems())) {
      if ($item -and $item.Path) { [Console]::Out.WriteLine($item.Path) }
    }
    break
  } catch {}
}`;

function execText(run, file, args) {
  return new Promise((resolveText, reject) => {
    run(file, args, {timeout: 2500, windowsHide: true, maxBuffer: 1024 * 1024, encoding: 'utf8'}, (error, stdout) => {
      if (error) reject(error);
      else resolveText(String(stdout ?? ''));
    });
  });
}

export function listedPaths(text) {
  return String(text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export async function captureFrontmostSelection({platform = process.platform, run = execFile} = {}) {
  try {
    if (platform === 'darwin') return listedPaths(await execText(run, 'osascript', ['-e', finderScript]));
    if (platform === 'win32') return listedPaths(await execText(run, 'powershell.exe', ['-NoProfile', '-STA', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', explorerScript]));
    return [];
  } catch {
    return [];
  }
}

export async function regularFiles(paths, {statImpl = stat, limit = 100, platform = process.platform} = {}) {
  const out = [];
  const seen = new Set();
  for (const raw of paths ?? []) {
    if (out.length >= limit) break;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const path = resolve(raw.trim());
    const key = platform === 'win32' ? path.toLowerCase() : path;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const info = await statImpl(path);
      if (info.isFile() && info.size > 0) out.push(path);
    } catch { /* skip missing paths and directories */ }
  }
  return out;
}

export async function frontmostFiles() {
  return regularFiles(await captureFrontmostSelection());
}

export const selectionScripts = {finderScript, explorerScript};
