# =============================================================================
# Dockerfile — organizaciones-back
# Stack: Node 22 · pnpm · NestJS 11 · Prisma 7
# =============================================================================

ARG CACHE_BUST=3

# ── Stage 1: dependencias ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Rebuild bcrypt nativo para alpine
RUN cd node_modules/bcrypt && npm rebuild bcrypt --build-from-source || true

# Generar cliente Prisma tipado
RUN npx prisma generate


# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma/
COPY . .

RUN rm -f pnpm-workspace.yaml

RUN node_modules/.bin/nest build

# Verificar output
RUN ls -la dist/ && echo "✓ dist generado"


# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY prisma ./prisma/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN ls -la dist/ && echo "✓ dist en runner"

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

# migrate deploy aplica migraciones pendientes antes de arrancar
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]