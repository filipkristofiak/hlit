# Creates a Start Menu shortcut for hlit: searchable via Start search, and
# bound to Ctrl+Alt+H as a system-wide launch hotkey (Windows shell shortcut
# keys require a Ctrl+Alt or Ctrl+Shift base -- plain Alt+<letter> cannot be
# registered this way). No background process needed: explorer.exe owns the
# hotkey table and launches electron.exe fresh on each press; the app exits
# normally when its window is closed (see main/main.js window-all-closed).

$repo = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $repo "node_modules\electron\dist\electron.exe"
$startMenu = [Environment]::GetFolderPath("StartMenu") + "\Programs"
$lnkPath = Join-Path $startMenu "hlit.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $electron
$shortcut.Arguments = "."
$shortcut.WorkingDirectory = $repo
$shortcut.IconLocation = "$electron,0"
$shortcut.Hotkey = "CTRL+ALT+H"
$shortcut.Description = "hlit - screenshot highlighter"
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Output "Created: $lnkPath"

# Read back to confirm
$check = $shell.CreateShortcut($lnkPath)
Write-Output "TargetPath: $($check.TargetPath)"
Write-Output "Arguments: $($check.Arguments)"
Write-Output "WorkingDirectory: $($check.WorkingDirectory)"
Write-Output "Hotkey: $($check.Hotkey)"
