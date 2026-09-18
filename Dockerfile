# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma's Debian engine needs OpenSSL; HTTPS clients need CA certificates.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
# Keep TypeScript/Prisma/tsx: next.config.ts and explicit release commands use them.
RUN npm ci --include=dev

FROM dependencies AS builder
COPY . .
ENV NODE_ENV=production \
    APP_ENV=staging \
    GA4_DATA_MODE=mock
# No DB access, migrations, seed, or authentication secrets during image build.
RUN npm run db:generate:pg \
    && npm run build \
    && mkdir -p public

FROM base AS runner
ENV NODE_ENV=production \
    APP_ENV=staging \
    GA4_DATA_MODE=mock \
    PORT=3000
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/next.config.ts /app/tsconfig.json ./
COPY --from=builder --chown=node:node /app/lib/security-headers.ts ./lib/security-headers.ts
COPY --from=builder --chown=node:node /app/lib/auth-diagnostics.ts ./lib/auth-diagnostics.ts
COPY --from=builder --chown=node:node /app/lib/server/env.ts ./lib/server/env.ts
COPY --from=builder --chown=node:node /app/prisma/postgresql ./prisma/postgresql
COPY --from=builder --chown=node:node /app/scripts/check-env.ts /app/scripts/create-admin.ts /app/scripts/diagnose-auth.ts ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{signal:AbortSignal.timeout(4000)}).then(async r=>process.exit(r.ok&&(await r.json()).status==='ok'?0:1)).catch(()=>process.exit(1))"
# Next reads PORT directly. Exec form preserves shutdown signal delivery.
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
