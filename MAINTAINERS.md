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

Releases are driven by release-please (`.github/workflows/release-please.yml`).
Every push to `main` runs it; when the commits since the last release deserve a
version bump, it opens a `chore(main): release X.Y.Z` pull request with the
changelog and version bump. Merging that pull request creates the `vX.Y.Z` tag
and the GitHub Release with auto-generated notes.

The tag push triggers `docker-publish.yml`, so both images are published at the
same moment the release is created. No manual tagging is needed.

### Release token

`release-please` must run with a token whose events trigger other workflows. The
default `GITHUB_TOKEN` never does, so without setup the tag it creates does not
fire `docker-publish.yml`. Set a fine-grained personal access token with
`Contents` (read and write) and `Pull requests` (read and write) permissions as
the `RELEASE_PLEASE_TOKEN` repository secret. The workflow falls back to
`GITHUB_TOKEN` if the secret is missing.
