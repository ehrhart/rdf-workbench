# RDF Workbench

RDF Workbench is a Next.js app for exploring and managing RDF triplestores. It
supports:

- [QLever](https://github.com/ad-freiburg/qlever)
- [Virtuoso](https://github.com/openlink/virtuoso-opensource)
- [Oxigraph](https://github.com/oxigraph/oxigraph)
- Any SPARQL 1.1-compliant endpoint

## Feature matrix

| Capability                         | QLever             | Virtuoso                                     | Oxigraph                   | Generic                      |
| ---------------------------------- | ------------------ | -------------------------------------------- | -------------------------- | ---------------------------- |
| Public SELECT                      | Yes                | Yes                                          | Yes                        | Yes                          |
| CONSTRUCT/DESCRIBE downloads       | Turtle             | Turtle, N-Triples, N-Quads, JSON-LD, RDF/XML | Turtle, N-Triples, RDF/XML | Turtle, N-Triples, RDF/XML   |
| Resource URL content negotiation   | Turtle, N-Triples  | Turtle, N-Triples, JSON-LD, RDF/XML          | Turtle, N-Triples, RDF/XML | Turtle, N-Triples, RDF/XML   |
| SPARQL Update                 | No     | Yes (via ISQL)                               | Yes                        | Yes                          |
| Import/export, graph deletion | No     | Yes                                          | Yes                        | Import via `LOAD`; no export |
| Full-text search              | Yes    | Yes                                          | No¹                        | No                           |

¹ Oxigraph does not support full-text search. See
[Oxigraph issue #48](https://github.com/oxigraph/oxigraph/issues/48).

## Quick start

### QLever

Copy `.env.example` to `.env`, set `SPARQL_ENDPOINT` and `RESOURCE_BASE_URI`,
and replace the bootstrap password.

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.qlever.yml up --build -d
```

### Virtuoso

Set `SPARQL_ENDPOINT`, the Virtuoso connection variables, and new secrets in
`.env`. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.virtuoso.yml up --build -d
```

### Oxigraph

Set `SPARQL_ENDPOINT` to the Oxigraph `/sparql` union endpoint and replace the
bootstrap password in `.env`. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.oxigraph.yml up --build -d
```

### Generic SPARQL 1.1 endpoint

Set `TRIPLESTORE_PROVIDER` to `generic` and configure `SPARQL_ENDPOINT` with
your SPARQL 1.1 endpoint:

```bash
TRIPLESTORE_PROVIDER=generic
SPARQL_ENDPOINT=https://data.example.org/sparql
```

## Use the published image

To use the image from GitHub Container Registry instead of building it, add the
relevant service configuration to your `compose.yml`. Replace placeholder
credentials and secrets with real values. Other variables are documented in
`.env.example`.

### QLever

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
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-8-characters
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data

volumes:
  rdf-workbench-data:
```

### Virtuoso

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
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-8-characters
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
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-8-characters
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

### Generic

```yaml
services:
  workbench:
    image: ghcr.io/ehrhart/rdf-workbench:latest
    environment:
      TRIPLESTORE_PROVIDER: generic
      SPARQL_ENDPOINT: https://my-triplestore.example/sparql
      WORKBENCH_URL: http://localhost:3000
      RESOURCE_BASE_URI: https://data.example.org
      WORKBENCH_DB_PATH: /data/workbench.sqlite
      BOOTSTRAP_ADMIN_USERNAME: admin
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-at-least-8-characters
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data

volumes:
  rdf-workbench-data:
```

## Configuration

### Common variables

- `TRIPLESTORE_PROVIDER`: `qlever`, `virtuoso`, `oxigraph`, or `generic`.
- `SPARQL_ENDPOINT`: HTTP SPARQL endpoint for the selected provider. For
  Oxigraph, use the `/sparql` union endpoint for queries and updates.
- `SPARQL_TIMEOUT_MS`: request timeout in milliseconds.
- `WORKBENCH_NAME`: display name. Defaults to `RDF Workbench`.
- `WORKBENCH_URL`: public origin used for redirects and mutation origin checks.
- `WORKBENCH_PORT`: host port mapped to the workbench container. The container
  listens on port `3000`.
- `RESOURCE_BASE_URI`: base IRI for dereferenceable resources. A configured path
  maps `/path/<id>` to `<RESOURCE_BASE_URI>/path/<id>`.
- `DEREFERENCE_PATHS`: optional comma- or whitespace-separated path segments to
  seed at startup. Only missing paths are added; existing rows, including paths
  managed in the admin UI, are preserved. Invalid entries are skipped with a
  warning. An empty value disables seeding.

  Dereferenceable resource URLs content-negotiate: when the request prefers an
  RDF media type in `Accept`, or `?format=` names one, the workbench sends a
  `DESCRIBE` for the resource to the engine and streams the response back
  as-is. The engine decides both the description and its serialization, and
  answers unsupported media types with its own error response. Browsers and
  unknown clients keep the HTML page. `?format=` takes a media type, such as
  `text/turtle`. Responses carry `Vary: Accept`.

- `WORKBENCH_DB_PATH`: SQLite database for workbench data, including accounts,
  sessions, saved queries, dereference paths, and prefixes.
- `ALLOW_ANONYMOUS_READ`: set to `1` or `true` to allow logged-out visitors to
  open read-only pages, including the dashboard, graphs overview, visual graph,
  and SPARQL console. Otherwise, these pages require a session. Administration
  pages and the monitor always require a session; for Virtuoso, import, ISQL,
  namespaces, and configuration do too. Writes are authenticated separately at
  the route or action level. Disabled by default.
- `ALLOW_ANONYMOUS_SPARQL`: set to `1` or `true` to allow logged-out clients to
  query the protocol endpoints `/sparql` and `/api/sparql*`. The SPARQL console
  page is controlled by `ALLOW_ANONYMOUS_READ`, not this flag. Disabled by
  default.
- `ALLOW_ANONYMOUS_ASK`: set to `1` or `true` to allow logged-out visitors to
  use the ask assistant. Applies only when the assistant is configured. Disabled
  by default.

The three anonymous-access flags can also be managed under **Setup > Access** in
the admin UI. A saved UI value takes precedence over the environment until
reset. Changes are recorded in the settings history.

### CORS variables

The public SPARQL query endpoints (`/sparql` and `/api/sparql/query`) serve
cross-origin browser requests by default, matching the permissive CORS of the
triplestore engines behind them (QLever answers `Access-Control-Allow-Origin:
*`) and of the Virtuoso endpoints these workbenches replace. Preflights are
answered with `204` and allow methods `GET`, `HEAD`, `POST`, `OPTIONS` and
request headers `Accept`, `Authorization`, `Content-Type`. Cookie-gated
surfaces are unaffected: the wildcard origin cannot carry credentials.

- `CORS_ENABLED`: set to `0` or `false` to serve same-origin browser clients
  only. On by default.
- `CORS_ALLOWED_ORIGINS`: `*` (the default) allows every origin. A
  comma-separated list restricts responses to exactly those origins, e.g.
  `https://app.example.org,https://map.example.org`; requests from other
  origins get no `Access-Control-*` headers, and answers then carry
  `Vary: Origin`.
- `CORS_EXPOSE_HEADERS`: comma-separated response headers exposed to browser
  clients beyond the CORS-safelisted ones, e.g. `Content-Disposition` for
  clients that want the download filename. Empty by default.

### Ask assistant variables

The assistant is enabled only when `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`
are all set.

- `AI_BASE_URL`: base URL of an OpenAI-compatible API.
- `AI_API_KEY`: API key for that API.
- `AI_MODEL`: model name.
- `AI_MAX_STEPS`: maximum tool steps per question. Defaults to `20`.
- `AI_QUERY_TIMEOUT_MS`: query timeout in milliseconds. Defaults to `30000`.
- `AI_RESULT_LIMIT`: maximum rows read per query. Defaults to `1000`.
- `AI_JOB_TIMEOUT_MS`: timeout for background AI jobs, including the knowledge
  graph summary and dataset profile build. Defaults to `900000` (15 minutes),
  with a maximum of `3600000`.
- `AI_PROFILE_MAX_CLASSES`: maximum classes in a dataset profile. Defaults to
  `60`.
- `AI_PROFILE_MAX_PROPERTIES`: maximum properties per class in a dataset
  profile. Defaults to `30`.
- `AI_PROFILE_MAX_SAMPLES`: maximum sample values per property. Defaults to `3`.

All seven tuning variables can also be set under **Setup > AI settings**. Saved
UI values take precedence until reset. An invalid environment value affects only
its setting, which falls back to the default.

### Local accounts

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

These set the initial admin account when the users table is empty.

### Oxigraph

- `OXIGRAPH_PORT`: host port for the Oxigraph server. Defaults to `7878`.

### Virtuoso

The workbench uses these frontend variables:

- `VIRTUOSO_ADAPTER_URL`
- `VIRTUOSO_ADAPTER_TOKEN`: shared token, at least 32 characters.
- Graph export path, size limit, and polling settings, as listed in
  `.env.example`.

The adapter also requires the Virtuoso host, ISQL port, account credentials,
adapter token, import path, and upload limit. See `.env.example` for the full
list and defaults.

## Local development

### Frontend

```bash
cd frontend
pnpm install
cp ../.env.example .env.local
pnpm dev
```

### Virtuoso adapter

Run this when developing the Virtuoso provider:

```bash
cd virtuoso-adapter
npm install
npm run dev
```

### Oxigraph

Run Oxigraph locally for Oxigraph provider development:

```bash
docker run --rm -p 7878:7878 -v oxigraph-dev-data:/data oxigraph/oxigraph:0.5.9 serve --location /data --bind 0.0.0.0:7878 --union-default-graph
```

Set `SPARQL_ENDPOINT` to `http://localhost:7878/sparql`.
