# RDF Workbench

RDF Workbench is a Next.js application for exploring and managing RDF
triplestores. It currently supports:

- [QLever](https://github.com/ad-freiburg/qlever)
- [Virtuoso](https://github.com/openlink/virtuoso-opensource)
- [Oxigraph](https://github.com/oxigraph/oxigraph)

## Feature matrix

There are some differences between the providers:

| Capability                            | QLever              | Virtuoso                                     | Oxigraph                   |
| ------------------------------------- | ------------------- | -------------------------------------------- | -------------------------- |
| Public SELECT/ASK                     | Yes                 | Yes                                          | Yes                        |
| SELECT result downloads               | JSON, XML, CSV, TSV | JSON, XML, CSV, TSV                          | JSON, XML, CSV, TSV        |
| CONSTRUCT/DESCRIBE downloads          | Turtle              | Turtle, N-Triples, N-Quads, JSON-LD, RDF/XML | Turtle, N-Triples, RDF/XML |
| Named graphs and resource exploration | Read-only           | Read/write                                   | Read/write                 |
| Authentication                        | Local database      | Virtuoso database login                      | Local database             |
| SPARQL Update                         | No                  | Via ISQL                                     | Yes                        |
| Import/export, graph deletion         | No                  | Yes                                          | Yes                        |
| Full-text search                      | Yes                 | Yes                                          | No ¹                       |

¹ Oxigraph does not support full-text search (see
[Oxigraph issue #48](https://github.com/oxigraph/oxigraph/issues/48))

## Quick start: QLever

Copy `.env.example` to `.env`, set your QLever SPARQL endpoint and resource base
URI, and replace the bootstrap password:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.qlever.yml up --build -d
```

## Quick start: Virtuoso

Set `SPARQL_ENDPOINT`, the Virtuoso connection variables, and fresh secrets in
`.env`, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.virtuoso.yml up --build -d
```

## Quick start: Oxigraph

Set `SPARQL_ENDPOINT` to the Oxigraph `/sparql` union endpoint and replace the
bootstrap password in `.env`, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.oxigraph.yml up --build -d
```

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
      RESOURCE_BASE_URI: https://data.example.org
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
      RESOURCE_BASE_URI: https://data.example.org
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

### Oxigraph

Set the secrets to real values; the remaining variables follow `.env.example`.

```yaml
services:
  workbench:
    image: ghcr.io/ehrhart/rdf-workbench:latest
    environment:
      TRIPLESTORE_PROVIDER: oxigraph
      SPARQL_ENDPOINT: http://oxigraph:7878/sparql
      WORKBENCH_URL: http://localhost:3000
      RESOURCE_BASE_URI: https://data.example.org
      WORKBENCH_DB_PATH: /data/workbench.sqlite
      BOOTSTRAP_ADMIN_USERNAME: admin
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-12-characters
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data
    depends_on:
      oxigraph:
        condition: service_healthy

  oxigraph:
    image: oxigraph/oxigraph:0.5.9
    command:
      [
        "serve",
        "--location",
        "/data",
        "--bind",
        "0.0.0.0:7878",
        "--union-default-graph",
      ]
    ports:
      - "7878:7878"
    volumes:
      - oxigraph-data:/data

volumes:
  rdf-workbench-data:
  oxigraph-data:
```

## Configuration

Common runtime variables:

- `TRIPLESTORE_PROVIDER`: `qlever`, `virtuoso`, or `oxigraph`.
- `SPARQL_ENDPOINT`: selected provider's HTTP SPARQL endpoint. For Oxigraph,
  point this at the `/sparql` union endpoint (queries and updates).
- `SPARQL_TIMEOUT_MS`: request timeout in milliseconds.
- `WORKBENCH_NAME`: runtime display name; defaults to `RDF Workbench`.
- `WORKBENCH_URL`: externally visible origin used for redirects and mutation
  origin checks.
- `RESOURCE_BASE_URI`: base IRI of dereferenceable resources. A path configured
  for dereferencing maps `/path/<id>` to `<RESOURCE_BASE_URI>/path/<id>`.
- `WORKBENCH_DB_PATH`: sqlite database holding workbench-owned data (saved
  queries, dereference paths, prefixes).

Local-account providers (QLever and Oxigraph):

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

Oxigraph variables:

- `OXIGRAPH_PORT`: host port for the Oxigraph server; defaults to `7878`.

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

Oxigraph, when working on the Oxigraph provider:

```bash
docker run --rm -p 7878:7878 -v oxigraph-dev-data:/data oxigraph/oxigraph:0.5.9 serve --location /data --bind 0.0.0.0:7878 --union-default-graph
```

Point `SPARQL_ENDPOINT` at `http://localhost:7878/sparql`.
