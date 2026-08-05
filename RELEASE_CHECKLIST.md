# Lighthouse Release Checklist

Use this before and after every release build.

## Pre-release

- [ ] All tests pass locally (`node core.js` starts, `/api/health` returns `ready`)
- [ ] Version bumped in `package.json`
- [ ] Model downloaded if building model-inclusive archives: `node setup.js`
- [ ] Disk space: ~5GB per model-inclusive platform, ~50MB for portable
- [ ] Tools: `tar`, `gzip`, `zip`
- [ ] Docker available for `docker` target (optional)
- [ ] Android SDK + Capacitor for APK builds (optional)

## Build

```bash
node release.js --dry-run       # Preview all 13 formats
node release.js all             # Build everything
node release.js desktop         # 6 desktop platforms
node release.js mobile          # Android APK + iOS Xcode
node release.js portable        # No-model zip
node release.js linux-arm64     # Single platform
./release.sh all
```

### Universal release matrix

| Platform | Archive | Model |
|----------|---------|-------|
| linux-x64 | tar.gz | Yes |
| linux-arm64 | tar.gz | Yes |
| linux-armv7l | tar.gz | Yes |
| macos-x64 | tar.gz | Yes |
| macos-arm64 | tar.gz | Yes |
| windows-x64 | zip | Yes |
| android-arm64 | apk | No (needs server) |
| android-armv7 | apk | Alias of arm64 APK |
| ios | tar.gz | Xcode project |
| portable | zip | No |
| docker | tar | No (volume mount) |
| rpi-installer | tar.gz | Installer (not raw .img) |
| community-kit | tar.gz | Full field kit |

## Post-release verification

- [ ] `sha256sum -c releases/SHA256SUMS`
- [ ] Check `releases/manifest.json`
- [ ] Extract one build: `npm install --production && node core.js`
- [ ] Upload all files from `releases/` to GitHub Release
- [ ] Copy `RELEASE_NOTES.md` to release description
- [ ] `git tag v1.0.1 && git push --tags`

## Notes

- **android-armv7** shares the same universal APK as android-arm64
- **rpi-installer** is a tarball + install script, not a bootable SD image
- **community-kit** excludes `node_modules`, `.git`, `releases/`
- Streaming SHA256 — safe on 4GB RAM machines
