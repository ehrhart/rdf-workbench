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
| Server configuration                  | No                  | Yes                                          |

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

## Configuration

Common runtime variables:

- `TRIPLESTORE_PROVIDER`: `qlever` or `virtuoso`.
- `SPARQL_ENDPOINT`: selected provider's HTTP SPARQL endpoint.
- `SPARQL_TIMEOUT_MS`: request timeout in milliseconds.
- `WORKBENCH_NAME`: runtime display name; defaults to `RDF Workbench`.
- `WORKBENCH_URL`: externally visible origin used for redirects and mutation
  origin checks.

QLever variables:

- `WORKBENCH_DB_PATH`
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

## Clean-break migration notes

There are no aliases for the former `VIRTUOSO_SPARQL_ENDPOINT`,
`ISQL_BRIDGE_URL`, or `NEXT_PUBLIC_*` configuration. The service and package
previously called `isql-bridge` are now `virtuoso-adapter`. Update deployment
files and secrets before upgrading.

Virtuoso data and saved queries remain in Virtuoso. QLever uses a separate
SQLite database; no saved-query or prefix migration is attempted between
providers.

## Verification smoke matrix

Run `pnpm lint` and `pnpm build` in `frontend`, plus `npm run build` in
`virtuoso-adapter`. Then verify:

- Virtuoso: login/logout, saved-query ownership, namespaces, ISQL, imports,
  full-text administration, graph mutation/export, and both monitor pages.
- QLever: typed-literal SELECT, ASK, syntax/upstream error display, timeouts,
  graph listing/visualization, direct resource lookup, supported downloads, and
  public ping/stats/settings.
- QLever writes: SPARQL Update returns 405; Virtuoso-only pages and APIs return
  404 and are absent from navigation.
- Authorization: anonymous reads work; saved-query ownership and prefix/user
  admin rules are enforced; disable/reset revokes sessions; the final active
  administrator cannot be disabled.
- Deployment: QLever starts without the adapter and persists SQLite; Virtuoso
  starts with `virtuoso-adapter`; the frontend contains no DBA credentials.

The provider-aware health endpoint is `GET /health`.
