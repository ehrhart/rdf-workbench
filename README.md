# RDF Workbench

RDF Workbench is a Next.js application for exploring and managing RDF
triplestores. It currently supports:

- [QLever](https://github.com/ad-freiburg/qlever)
- [Virtuoso](https://github.com/openlink/virtuoso-opensource)

## Feature matrix

There are some differences between the two providers:

| Capability                            | QLever              | Virtuoso                                     |
| ------------------------------------- | ------------------- | -------------------------------------------- |
| Public SELECT/ASK                     | Yes                 | Yes                                          |
| SELECT result downloads               | JSON, XML, CSV, TSV | JSON, XML, CSV, TSV                          |
| CONSTRUCT/DESCRIBE downloads          | Turtle              | Turtle, N-Triples, N-Quads, JSON-LD, RDF/XML |
| Named graphs and resource exploration | Read-only           | Read/write                                   |
| Authentication                        | Local database      | Virtuoso database login                      |
| SPARQL Update                         | No                  | Via ISQL                                     |
| Import/export, graph deletion         | No                  | Yes                                          |
| Text search                           | Yes                 | Yes                                          |

## Quick start: QLever

Copy `.env.example` to `.env`, keep the development endpoint, and replace the
bootstrap password:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.qlever.yml up --build -d
```

The default development endpoint is
`https://climatesense-qlever-server.tools.eurecom.fr/`. SQLite lives in the
named `qlever-workbench-data` volume and survives container recreation. The
bootstrap administrator is created only when the `users` table is empty.

## Quick start: Virtuoso

Set `SPARQL_ENDPOINT`, the Virtuoso connection variables, and fresh secrets in
`.env`, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.virtuoso.yml up --build -d
```

Only `virtuoso-adapter` receives the DBA credentials; the frontend image has
none. For bulk loading, the mounted imports directory must be visible to
Virtuoso and allowed by `DirsAllowed`.

## Quick start: published image

Instead of building, use the image published to GitHub Container Registry. Add
this to your own `compose.yml`:

### QLever

Set the secrets to real values; the remaining variables follow `.env.example`.

```yaml
services:
  workbench:
    image: ghcr.io/ehrhart/rdf-workbench:latest
    environment:
      TRIPLESTORE_PROVIDER: qlever
      SPARQL_ENDPOINT: https://my-triplestore.example/sparql
      WORKBENCH_URL: http://localhost:3000
      WORKBENCH_DB_PATH: /data/workbench.sqlite
      BOOTSTRAP_ADMIN_USERNAME: admin
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-12-characters
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data

volumes:
  rdf-workbench-data:
```

### Virtuoso

Set the secrets to real values; the remaining variables follow `.env.example`.

```yaml
services:
  workbench:
    image: ghcr.io/ehrhart/rdf-workbench:latest
    environment:
      TRIPLESTORE_PROVIDER: virtuoso
      SPARQL_ENDPOINT: https://my-triplestore.example/sparql
      WORKBENCH_URL: http://localhost:3000
      WORKBENCH_DB_PATH: /data/workbench.sqlite
      SESSION_SECRET: replace-with-at-least-32-characters
      VIRTUOSO_ADAPTER_URL: http://virtuoso-adapter:50118
      VIRTUOSO_ADAPTER_TOKEN: replace-with-at-least-32-characters
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data

  virtuoso-adapter:
    image: ghcr.io/ehrhart/rdf-workbench-virtuoso-adapter:latest
    environment:
      VIRTUOSO_ADAPTER_TOKEN: replace-with-at-least-32-characters
      VIRTUOSO_HOST: host.docker.internal
      VIRTUOSO_ISQL_PORT: 1111
      VIRTUOSO_DBA_USER: dba
      VIRTUOSO_DBA_PASSWORD: replace-this-password
    volumes:
      - rdf-workbench-imports:/app/imports
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  rdf-workbench-imports:
```

## Configuration

Common runtime variables:

- `TRIPLESTORE_PROVIDER`: `qlever` or `virtuoso`.
- `SPARQL_ENDPOINT`: selected provider's HTTP SPARQL endpoint.
- `SPARQL_TIMEOUT_MS`: request timeout in milliseconds.
- `WORKBENCH_NAME`: runtime display name; defaults to `RDF Workbench`.
- `WORKBENCH_URL`: externally visible origin used for redirects and mutation
  origin checks.
- `WORKBENCH_DB_PATH`: sqlite database holding workbench-owned data (saved
  queries, dereference paths, prefixes).

QLever variables:

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

Virtuoso frontend variables:

- `SESSION_SECRET` (at least 32 characters)
- `VIRTUOSO_ADAPTER_URL`
- `VIRTUOSO_ADAPTER_TOKEN` (at least 32 characters)
- optional graph export limit and polling variables shown in `.env.example`

Virtuoso adapter variables include the host, ISQL port, DBA credentials, SPARQL
endpoint, adapter token, import path, upload limit, and session limits. See
`.env.example` for the complete clean-break schema.

## Local development

Frontend:

```bash
cd frontend
pnpm install
cp ../.env.example .env.local
pnpm dev
```

Virtuoso adapter, when working on the Virtuoso provider:

```bash
cd virtuoso-adapter
npm install
npm run dev
```
