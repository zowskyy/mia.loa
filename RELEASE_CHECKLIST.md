# Lighthouse Release Checklist

Use this before and after every release build.

## Pre-release

- [ ] All tests pass locally (`node core.js` starts, `/api/health` returns `ready`)
- [ ] Version bumped in `package.json` (must match `release.js` output)
- [ ] `CHANGELOG` or release notes drafted for GitHub
- [ ] Model downloaded if building model-inclusive archives: `node setup.js`
- [ ] Disk space: ~5GB per model-inclusive platform, ~50MB for portable
- [ ] Tools installed: `tar`, `gzip`, `zip` (or `npm install archiver` for cross-platform archives)
- [ ] Docker available if building `docker` target (optional)

## Build

```bash
# Preview what will be built (7 unique + 1 alias)
node release.js --dry-run

# Build all platforms
node release.js --all

# Or use the shell wrapper
./release.sh --all

# Optional extras
node release.js --all docker rpi
```

### Platform matrix

| Platform | Archive | Includes model |
|----------|---------|----------------|
| linux-x64 | tar.gz | Yes |
| linux-arm64 | tar.gz | Yes |
| linux-armv7l | tar.gz | Yes |
| macos-x64 | tar.gz | Yes |
| macos-arm64 | tar.gz | Yes |
| win-x64 | zip | Yes |
| android-termux | tar.gz | Yes (alias of linux-arm64) |
| portable | zip | No |

## Post-release verification

- [ ] Check `releases/manifest.json` — all platforms listed with SHA256
- [ ] Spot-check one archive: extract, `npm install`, `node core.js`
- [ ] Verify `RELEASE_NOTES.md` inside archive has correct filename (not `undefined`)
- [ ] Verify `.sha256` checksums: `sha256sum -c lighthouse-*-linux-x64.tar.gz.sha256`
- [ ] Upload archives to GitHub Releases
- [ ] Tag commit: `git tag v1.0.1 && git push origin v1.0.1`

## Known constraints

- **android-termux** shares the linux-arm64 binary (alias copy, not a separate build)
- **portable** has no model — users run `node setup.js` after extract
- Builds on 4GB RAM machines use streaming checksums (safe)
- `latest` symlinks in `releases/` may fall back to copies on Windows without symlink permission
