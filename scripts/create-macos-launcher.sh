#!/bin/bash
# Installs a small searchable app in ~/Applications; Electron still runs from
# this checkout, so edits to the repo take effect without repackaging.
set -euo pipefail

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
electron="$repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
icon="$repo/assets/hlit_icon.png"
app="$HOME/Applications/hlit.app"
resources="$app/Contents/Resources"
executable="$app/Contents/MacOS/hlit"

if [[ ! -x "$electron" ]]; then
  printf 'Electron not found; run npm install first: %s\n' "$electron" >&2
  exit 1
fi
if [[ -e "$app" || -L "$app" ]] && [[ ! -f "$resources/.hlit-repo-launcher" ]]; then
  printf 'Refusing to replace an existing app: %s\n' "$app" >&2
  exit 1
fi

mkdir -p "$resources" "$app/Contents/MacOS"
printf -v electron_arg '%q' "$electron"
printf -v repo_arg '%q' "$repo"
printf '#!/bin/bash\nexec %s %s\n' "$electron_arg" "$repo_arg" > "$executable"
chmod +x "$executable"

cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.filipkristofiak.hlit.launcher</string>
  <key>CFBundleName</key><string>hlit</string>
  <key>CFBundleDisplayName</key><string>hlit</string>
  <key>CFBundleExecutable</key><string>hlit</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>hlit.icns</string>
</dict></plist>
PLIST

# A Dock PNG alone isn't a Finder/Spotlight app icon; iconutil needs the
# standard ten sizes in an iconset to build the bundle's .icns.
tmp=$(mktemp -d "${TMPDIR:-/tmp}/hlit-icon.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
iconset="$tmp/hlit.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$icon" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -z "$double" "$double" "$icon" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$resources/hlit.icns"
printf '%s\n' "$repo" > "$resources/.hlit-repo-launcher"

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"
printf 'Installed: %s\nSearch Spotlight for hlit, or run: open -a "%s"\n' "$app" "$app"
