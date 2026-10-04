# Virtuoso adapter

This private Node.js/ODBC service provides the Virtuoso-only capabilities used
by RDF Workbench: ISQL, bulk loading, native graph export, configuration, and
server administration.

It must not be deployed for QLever. Keep it on an internal network; only the
frontend needs to reach it, using the shared `VIRTUOSO_ADAPTER_TOKEN`.

Required configuration:

- `VIRTUOSO_ADAPTER_TOKEN` (at least 32 characters)
- `VIRTUOSO_HOST`, `VIRTUOSO_ISQL_PORT`
- `VIRTUOSO_DBA_USER`, `VIRTUOSO_DBA_PASSWORD`
- `VIRTUOSO_IMPORTS_PATH`

Optional connection and upload limits are listed in the root `.env.example`.

```bash
npm install
npm run build
npm start
```

See the root README and `docker-compose.virtuoso.yml` for deployment.
