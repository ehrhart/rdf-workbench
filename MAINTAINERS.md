# Maintainers

## Published images

Every push to `main` builds and publishes two images to GitHub Container
Registry with the `latest` tag. Pushing a `vX.Y.Z` git tag publishes that
release as `X.Y.Z`, `X.Y`, `X`, and `vX.Y.Z`.

- `ghcr.io/ehrhart/rdf-workbench`: the web application.
- `ghcr.io/ehrhart/rdf-workbench-virtuoso-adapter`: the Virtuoso bridge.

The workflow is `.github/workflows/docker-publish.yml`. It builds both images
for `linux/amd64` and `linux/arm64`.

## Publish a release

Tag the commit and push it:

```bash
git tag v0.2.0
git push origin v0.2.0
```
