# Releasing

## Policy

Run the latest tag, or `main`. Older versions get no fixes — there is no
backport branch and no LTS. Tags exist so a release is nameable: they mark
known-good points in history, and an issue reporter can say which build
they hit the bug on instead of "whatever `git pull` gave me on Tuesday".

## Where the version shows up

The help overlay footer (press `?`) shows `vX.Y.Z`. On macOS, the
**hlit ▸ About hlit** panel shows the same version without the `v` prefix.
Both source it from `package.json` via Electron's `app.getVersion()`.
The Spotlight launcher clones Electron's bundle, so its `Info.plist`
retains Electron's bundle version; the About panel overrides that with
hlit's version. There is no second hlit version to bump.

`SETTINGS_VERSION` (`renderer/state.js`) and `THEME_VERSION`
(`renderer/themes.js`) are unrelated on-disk file-format versions, not the
app version. Do not conflate them with a release.

## Cutting a release

Prepare a release pull request from a feature branch:

1. Move the bullets under `## Unreleased` into a new
   `## X.Y.Z — YYYY-MM-DD` section in `CHANGELOG.md`.
2. Bump `package.json` and `package-lock.json` together (for example,
   `npm version minor --no-git-tag-version`). Run `npm run check` and
   `node scripts/release-notes.mjs vX.Y.Z` before committing.
3. Push the branch and open a pull request. Do **not** tag before the
   release commit lands on `main`.

After the pull request is merged, on an up-to-date, clean `main`:

```sh
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main vX.Y.Z
```

The tag push runs the release workflow. The workflow reads the changelog
at the tagged commit; a missing matching section fails the job and no
release is published. Watch it with `gh run watch`, then confirm with
`gh release view vX.Y.Z`. Delete the merged feature branch remotely and
locally after switching to `main`.

## If a tag's CHANGELOG section is missing or the checks fail

The workflow fails before `gh release create` runs, so no partial release
is left behind. Fix the CHANGELOG (or whatever `npm run check` caught) on
`main`, then delete and re-push the tag:

```sh
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
# fix, commit, then re-tag and push again
```
