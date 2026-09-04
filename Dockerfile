# NABD API — multi-stage build.

# ── build ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Manifests first, so a source-only change does not invalidate the dependency
# layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.build.json ./
COPY packages/shared/package.json        packages/shared/
COPY packages/ledger/package.json        packages/ledger/
COPY packages/auth/package.json          packages/auth/
COPY packages/security/package.json      packages/security/
COPY packages/payments/package.json      packages/payments/
COPY packages/notifications/package.json packages/notifications/
COPY packages/compliance/package.json    packages/compliance/
COPY packages/database/package.json      packages/database/
COPY apps/api/package.json               apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm --filter @nabd/api prisma:generate \
 && pnpm build \
 && pnpm --filter @nabd/api build \
 && pnpm prune --prod

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Never run as root.
RUN addgroup -g 1001 nabd && adduser -u 1001 -G nabd -s /bin/sh -D nabd

# dumb-init reaps zombies and, more importantly here, forwards SIGTERM to the
# app so the graceful-shutdown path actually runs on a rolling deploy.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

COPY --from=builder --chown=nabd:nabd /app/node_modules      ./node_modules
COPY --from=builder --chown=nabd:nabd /app/packages          ./packages
COPY --from=builder --chown=nabd:nabd /app/apps/api/dist     ./apps/api/dist
COPY --from=builder --chown=nabd:nabd /app/apps/api/package.json ./apps/api/

USER nabd
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
