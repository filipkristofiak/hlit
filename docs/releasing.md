# Releasing

## Policy

Run the latest tag, or `main`. Older versions get no fixes — there is no
backport branch and no LTS. Tags exist so a release is nameable: they mark
known-good points in history, and an issue reporter can say which build
they hit the bug on instead of "whatever `git pull` gave me on Tuesday".

## Where the version shows up

The help overlay footer (press `?`): `v0.2.0 · ...`. It is sourced from
`package.json`'s `version` field via Electron's `app.getVersion()` — there
is no second place the version is kept.

`SETTINGS_VERSION` (`renderer/state.js`) and `THEME_VERSION`
(`renderer/themes.js`) are unrelated on-disk file-format versions, not the
app version. Do not conflate them with a release.

## Cutting a release

From `main`, with a clean tree:

```sh
# 1. Move the bullets under "## Unreleased" into a new
#    "## X.Y.Z — YYYY-MM-DD" section in CHANGELOG.md, then commit it.
git commit -am "Changelog for X.Y.Z"

# 2. Bump package.json + package-lock.json, commit, and create the vX.Y.Z tag.
npm version minor -m "Release v%s"        # or `patch` for a fix-only release

# 3. Push the commits and the tag; the tag push runs the release workflow.
git push origin main --follow-tags
```

Notes:

- The CHANGELOG edit must come *before* `npm version`. The release workflow
  reads the CHANGELOG at the tagged commit; a tag pushed without a matching
  section fails the job (`scripts/release-notes.mjs`) and no release is
  published.
- `npm version minor` creates the `v`-prefixed tag itself — do not also run
  `git tag`.
- Watch it: `gh run watch`, then `gh release view vX.Y.Z`.

## If a tag's CHANGELOG section is missing or the checks fail

The workflow fails before `gh release create` runs, so no partial release
is left behind. Fix the CHANGELOG (or whatever `npm run check` caught) on
`main`, then delete and re-push the tag:

```sh
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
# fix, commit, then re-tag and push again
```
