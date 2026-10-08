# Go backend

The Go service that is replacing the Next.js API routes one area at a time (see `docs/adr/0003-go-backend-rewrite.md`). A route moves here only when it returns exactly what the Node route returns; IIS then sends that path to this service.

## Routes served

| Path | Replaces |
| --- | --- |
| `GET /api/health` | `src/app/api/health/route.ts` |

## Run

Configuration comes only from environment variables: the same `DATABASE_URL`, `HOSXP_DB_*`, `SALARY_DB_*`, `NODE_ENV` and `LOG_LEVEL` the Node app uses, plus the `BACKEND_*` settings listed in the root `.env.example`. A missing required value stops startup and names the variable.

```
go run ./cmd/server
go test -race ./...
go test -run '^$' -bench . -benchmem ./...
GOOS=windows GOARCH=amd64 go build -o bin/thoen-backend.exe ./cmd/server
```

## Rules for porting a route

- Status codes, headers and JSON bytes match Node: same field names and order, `null` versus missing, date formats.
- HOSxP and salary databases are read-only. No schema changes anywhere; Prisma owns the primary schema.
- Every database call takes a `context.Context` with a timeout.
- Patient data is never logged in plaintext.
