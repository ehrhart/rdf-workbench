# RDF Workbench

RDF Workbench is an application for exploring and managing RDF triplestores
through a web interface and a SPARQL endpoint.

Supported backends:

- [QLever](https://github.com/ad-freiburg/qlever)
- [Virtuoso](https://github.com/openlink/virtuoso-opensource)
- [Oxigraph](https://github.com/oxigraph/oxigraph)
- Any SPARQL 1.1-compliant endpoint, using the generic provider

## Contents

- [Feature support](#feature-support)
- [Quick start](#quick-start)
- [Deploy the published image](#deploy-the-published-image)
- [Configuration](#configuration)
- [Local development](#local-development)

## Feature support

The features and RDF serializations available depend on the configured backend.

| Capability                         | QLever            | Virtuoso                                     | Oxigraph                   | Generic endpoint           |
| ---------------------------------- | ----------------- | -------------------------------------------- | -------------------------- | -------------------------- |
| Public `SELECT`                    | Yes               | Yes                                          | Yes                        | Yes                        |
| `CONSTRUCT` / `DESCRIBE` downloads | Turtle            | Turtle, N-Triples, N-Quads, JSON-LD, RDF/XML | Turtle, N-Triples, RDF/XML | Turtle, N-Triples, RDF/XML |
| Resource URL content negotiation   | Turtle, N-Triples | Turtle, N-Triples, JSON-LD, RDF/XML          | Turtle, N-Triples, RDF/XML | Turtle, N-Triples, RDF/XML |
| SPARQL Update                      | No                | Yes, via ISQL                                | Yes                        | Yes                        |
| Import, export, and graph deletion | No                | Yes                                          | Yes                        | Yes, via `LOAD`            |
| Full-text search                   | Yes               | Yes                                          | No ¹                       | No                         |

¹ Oxigraph does not support full-text search. See
[Oxigraph issue #48](https://github.com/oxigraph/oxigraph/issues/48).

## Quick start

### 1. Create your environment file

From the repository root, copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` for your selected backend, and replace the bootstrap administrator
password before starting the app.

### 2. Start the workbench and backend

Choose the Compose configuration that matches your triplestore.

#### QLever

Set `SPARQL_ENDPOINT` and `RESOURCE_BASE_URI` in `.env`. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.qlever.yml up --build -d
```

#### Virtuoso

Set `SPARQL_ENDPOINT`, `RESOURCE_BASE_URI`, the Virtuoso connection variables,
and new secrets in `.env`. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.virtuoso.yml up --build -d
```

#### Oxigraph

Set `RESOURCE_BASE_URI` in `.env`. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.oxigraph.yml up --build -d
```

#### Generic SPARQL 1.1 endpoint

To connect to a SPARQL 1.1 endpoint, configure the generic provider. For
example, add these values to `.env`:

```dotenv
TRIPLESTORE_PROVIDER=generic
SPARQL_ENDPOINT=https://data.example.org/sparql
RESOURCE_BASE_URI=https://data.example.org
```

The base `docker-compose.yml` starts the workbench from these values:

```bash
docker compose up --build -d
```

## Deploy the published image

You can use the published images from GitHub Container Registry instead of
building the app locally. Configure the workbench to point to your triplestore
and persist its SQLite database in a volume. Replace every example URL,
password, and token with values for your environment.

### Basic deployment

This example uses the QLever provider. Change `TRIPLESTORE_PROVIDER` and
`SPARQL_ENDPOINT` for your backend.

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
      BOOTSTRAP_ADMIN_PASSWORD: replace-with-a-strong-password
    ports:
      - "3000:3000"
    volumes:
      - rdf-workbench-data:/data

volumes:
  rdf-workbench-data:
```

`WORKBENCH_URL` is the public origin used for mutation origin checks, share
links, and secure cookies. Set it to the origin users actually access in your
deployment. The container listens on port `3000`, and the example maps it to
host port `3000`.

### Virtuoso adapter

For Virtuoso, set these variables on the workbench service:

```yaml
environment:
  TRIPLESTORE_PROVIDER: virtuoso
  VIRTUOSO_ADAPTER_URL: http://virtuoso-adapter:50118
  VIRTUOSO_ADAPTER_TOKEN: replace-with-at-least-32-characters
```

Add the adapter service to your Compose file. Point `VIRTUOSO_HOST` at the host
running Virtuoso, and replace the example credentials and token:

```yaml
services:
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

The adapter also needs its import path and upload limit configured. See
`.env.example` for the available adapter settings and defaults. The workbench
and adapter must use the same `VIRTUOSO_ADAPTER_TOKEN` value.

### Oxigraph service

For Oxigraph, set the following on the workbench service and add a dependency on
the Oxigraph service:

```yaml
environment:
  TRIPLESTORE_PROVIDER: oxigraph
  SPARQL_ENDPOINT: http://oxigraph:7878/sparql

depends_on:
  oxigraph:
    condition: service_healthy
```

The `service_healthy` condition requires a health check on the `oxigraph`
service:

```yaml
services:
  oxigraph:
    image: oxigraph/oxigraph:0.5.9
    command:
      - serve
      - --location
      - /data
      - --bind
      - 0.0.0.0:7878
      - --union-default-graph
    ports:
      - "7878:7878"
    volumes:
      - oxigraph-data:/data
    healthcheck:
      test: ["CMD", "/usr/local/bin/oxigraph", "--version"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s

volumes:
  oxigraph-data:
```

## Configuration

The `.env.example` file lists the supported settings and backend-specific
defaults. The variables below describe the main options.

### Core settings

| Variable | Description | Default |
| --- | --- | --- |
| `TRIPLESTORE_PROVIDER` | Backend provider: `qlever`, `virtuoso`, `oxigraph`, or `generic`. | required |
| `SPARQL_ENDPOINT` | HTTP SPARQL endpoint for the selected provider. For Oxigraph, use the `/sparql` union endpoint for queries and updates. | required |
| `SPARQL_TIMEOUT_MS` | Request timeout in milliseconds. | `60000` |
| `WORKBENCH_NAME` | Display name. | `RDF Workbench` |
| `WORKBENCH_URL` | Public origin used for mutation origin checks, share links, and secure cookies. | required |
| `WORKBENCH_PORT` | Host port mapped to the workbench container. | `3000` |
| `WORKBENCH_DB_PATH` | Path to the SQLite database for accounts, sessions, saved queries, dereference paths, prefixes, and other workbench data. | required |
| `RESOURCE_BASE_URI` | Base IRI for dereferenceable resources. For example, a configured path maps `/path/<id>` to `<RESOURCE_BASE_URI>/path/<id>`. | required |
| `DEREFERENCE_PATHS` | Optional comma- or whitespace-separated path segments to seed at startup. | none |

`DEREFERENCE_PATHS` only adds paths that do not already exist. Existing rows,
including paths managed in the admin UI, are preserved. Invalid entries are
skipped with a warning. An empty value disables seeding.

#### Resource URL content negotiation

When a dereferenceable resource URL receives an `Accept` header that prefers an
RDF media type, or a `?format=` parameter naming one (for example,
`?format=text/turtle`), the workbench runs a `DESCRIBE` query against the
triplestore and streams the response back unchanged. The engine chooses the
serialization and rejects unsupported media types. Browsers and clients that do
not request RDF receive the HTML page. Responses include `Vary: Accept`.

### Anonymous access

All three options are disabled by default. Set a variable to `1` or `true` to
enable the corresponding access.

| Variable                 | What it allows                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `ALLOW_ANONYMOUS_READ`   | Open the dashboard, graphs overview, visual graph, and SPARQL console without an account. |
| `ALLOW_ANONYMOUS_SPARQL` | Query the `/sparql` endpoint without an account.                                          |
| `ALLOW_ANONYMOUS_ASK`    | Use the ask assistant without an account, if the assistant is configured.                 |

Admin pages and the monitor always require a session, as do Virtuoso import,
ISQL, and namespace management. Write operations are authenticated separately at
the route or action level. `ALLOW_ANONYMOUS_SPARQL` does not control access to
the SPARQL console page. That page is governed by `ALLOW_ANONYMOUS_READ`.

These three settings can also be managed in **Setup > Access** in the admin UI.
A saved UI value takes precedence over the environment variable until it is
reset. Changes are recorded in the settings history.

### SPARQL endpoint

Browsers opening `/sparql` get the query console. Any other request is a SPARQL
Protocol call, whatever `Accept` header it sends:

- **Queries:** `GET /sparql?query=...` or `POST /sparql` with a form `query=`
  parameter or an `application/sparql-query` body. Responses stream the engine's
  answer in the negotiated media type.
- **Updates:** `POST /sparql` with a form `update=` parameter or an
  `application/sparql-update` body. Updates require a session and a same-origin
  `Origin` header and return `204` on success.
- **Output format:** `?format=` and `?output=` take a full media type
  (`text/turtle`) or a short name (`json`, `csv`, `ttl`, `nt`, `nq`, `jsonld`,
  `rdf`, `rdfxml`, `xml`, `tsv`, `html`). Unknown values return `406`.

Logged-in users see their queries in the query monitor. Anonymous queries can
only be cancelled by an administrator.

### CORS

The SPARQL endpoint serves cross-origin browser requests by default. Preflight
requests return `204` and allow the methods `GET`, `HEAD`, `POST`, and
`OPTIONS`, with the request headers `Accept`, `Authorization`, and
`Content-Type`.

| Variable | Description | Default |
| --- | --- | --- |
| `CORS_ENABLED` | Set to `0` or `false` to restrict the endpoint to same-origin browser clients. | Enabled |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins, such as `https://app.example.org,https://map.example.org`. Other origins receive no `Access-Control-*` headers. In list mode, responses to allowed origins include `Vary: Origin`. | `*` |
| `CORS_EXPOSE_HEADERS` | Comma-separated list of additional response headers exposed to browser clients, such as `Content-Disposition`. | none |

### Ask assistant

The ask assistant is enabled only when all three variables below are set.

| Variable      | Description                           |
| ------------- | ------------------------------------- |
| `AI_BASE_URL` | Base URL of an OpenAI-compatible API. |
| `AI_API_KEY`  | API key for that API.                 |
| `AI_MODEL`    | Model name.                           |

The following tuning options have these defaults:

| Variable                    | Description                                                                                                          | Default               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `AI_MAX_STEPS`              | Maximum tool steps per question.                                                                                     | `20`                  |
| `AI_QUERY_TIMEOUT_MS`       | Query timeout in milliseconds.                                                                                       | `30000`               |
| `AI_RESULT_LIMIT`           | Maximum rows read per query.                                                                                         | `1000`                |
| `AI_JOB_TIMEOUT_MS`         | Timeout for background AI jobs, including the knowledge graph summary and dataset profile build. Maximum: `3600000`. | `900000` (15 minutes) |
| `AI_PROFILE_MAX_CLASSES`    | Maximum classes in a dataset profile.                                                                                | `60`                  |
| `AI_PROFILE_MAX_PROPERTIES` | Maximum properties per class in a dataset profile.                                                                   | `30`                  |
| `AI_PROFILE_MAX_SAMPLES`    | Maximum sample values per property.                                                                                  | `3`                   |

All seven tuning options can also be set under **Setup > AI settings**. Saved UI
values take precedence until reset. An invalid environment value affects only
that setting, which falls back to its default.

### Local accounts

| Variable                   | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `BOOTSTRAP_ADMIN_USERNAME` | Username for the initial administrator account. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for the initial administrator account. |

These values are used only when the users table is empty.

### Oxigraph

| Variable | Description | Default |
| --- | --- | --- |
| `OXIGRAPH_PORT` | Host port for the Oxigraph server. | `7878` |

### Virtuoso

The workbench uses these variables to connect to the Virtuoso adapter:

| Variable                 | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `VIRTUOSO_ADAPTER_URL`   | Adapter URL. In the Compose example, this is `http://virtuoso-adapter:50118`. |
| `VIRTUOSO_ADAPTER_TOKEN` | Shared workbench/adapter token. Use at least 32 characters.                   |

The adapter itself requires the Virtuoso host, ISQL port, DBA credentials,
adapter token, import path, and upload limit. The `.env.example` file lists the
adapter variables for graph export path, size limit, and polling settings, along
with their defaults.

## Local development

### Frontend

From the repository root:

```bash
cd frontend
pnpm install
cp ../.env.example .env.local
pnpm dev
```

### Virtuoso adapter

```bash
cd virtuoso-adapter
npm install
npm run dev
```

### Oxigraph

Start Oxigraph in Docker with a persistent development volume:

```bash
docker run --rm -p 7878:7878 -v oxigraph-dev-data:/data \
  oxigraph/oxigraph:0.5.9 serve --location /data --bind 0.0.0.0:7878 \
  --union-default-graph
```

Set `SPARQL_ENDPOINT` to `http://localhost:7878/sparql` for local development.
