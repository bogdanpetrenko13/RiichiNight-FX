# Releases

1. Set `"version"` in `package.json` (e.g. `0.2.0`; it is shown in Settings → About).
2. Write the notes for players in `docs/releases/v0.2.0.md` (Russian, short).
3. Either push a tag `v0.2.0` on that commit, or on GitHub: Releases → Draft a
   new release → Choose a tag → `v0.2.0` → Create new tag → Publish release
   (title and text can stay empty; no file needed).

The **Build APK** workflow runs on the tag, runs every test, then creates the release
(or fills the one you published) with `RiichiNightFX-v0.2.0.apk` and the notes. The fixed
download link is
`https://github.com/bogdanpetrenko13/RiichiNight-FX/releases/download/v0.2.0/RiichiNightFX-v0.2.0.apk`
(`…/releases/latest` always points at the newest one).

The APK is the debug build signed with `signing/debug.keystore`, so it installs
over every earlier build and keeps saves. A store release would need its own key.
