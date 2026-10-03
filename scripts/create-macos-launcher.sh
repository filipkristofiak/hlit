#!/bin/bash
# Installs a searchable hlit app containing this checkout's Electron binary;
# the app code still loads from the checkout.
set -euo pipefail

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
electron="$repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
icon="$repo/assets/hlit_icon.png"
app="$HOME/Applications/hlit.app"

if [[ ! -x "$electron" ]]; then
  printf 'Electron not found; run npm install first: %s\n' "$electron" >&2
  exit 1
fi
if [[ -e "$app" || -L "$app" ]] && [[ ! -f "$app/Contents/Resources/.hlit-repo-launcher" ]]; then
  printf 'Refusing to replace an app not created by this script: %s (delete it manually if it is a stale hlit launcher)\n' "$app" >&2
  exit 1
fi

mkdir -p "$HOME/Applications"
stage=$(mktemp -d "$HOME/Applications/.hlit-launcher.XXXXXX")
trap 'rm -rf "$stage"' EXIT
staged="$stage/hlit.app"
cp -cR "$repo/node_modules/electron/dist/Electron.app" "$staged"

printf -v repo_arg '%q' "$repo"
printf '#!/bin/bash\nexec "${0%%/*}/Electron" %s\n' "$repo_arg" > "$staged/Contents/MacOS/hlit"
chmod +x "$staged/Contents/MacOS/hlit"

plist="$staged/Contents/Info.plist"
plutil -replace CFBundleExecutable -string hlit "$plist"
plutil -replace CFBundleName -string hlit "$plist"
plutil -replace CFBundleDisplayName -string hlit "$plist"
plutil -replace CFBundleIdentifier -string com.kristofiak.hlit "$plist"
plutil -replace CFBundleIconFile -string hlit.icns "$plist"

# A Dock PNG alone isn't a Finder/Spotlight app icon; iconutil needs the
# standard ten sizes in an iconset to build the bundle's .icns.
iconset="$stage/hlit.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$icon" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -z "$double" "$double" "$icon" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$staged/Contents/Resources/hlit.icns"
printf '%s\n' "$repo" > "$staged/Contents/Resources/.hlit-repo-launcher"

if [[ -e "$app" || -L "$app" ]]; then
  mv "$app" "$stage/old.app"
fi
if ! mv "$staged" "$app"; then
  if [[ -e "$stage/old.app" || -L "$stage/old.app" ]]; then
    mv "$stage/old.app" "$app"
  fi
  exit 1
fi

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"
printf 'Installed: %s\nSearch Spotlight for hlit, or run: open -a "%s"\n' "$app" "$app"
