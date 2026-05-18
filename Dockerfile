# =============================================================================
# Dockerfile — organizaciones-back
# Stack: Node 22 · pnpm · NestJS 11 · Prisma 7
# Fix: duplicate COPY dist, nodenext module output, build verification
# =============================================================================

ARG CACHE_BUST=5

# ── Stage 1: dependencias ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

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
COPY --from=deps /app/prisma.config.ts ./prisma.config.ts
COPY . .

RUN rm -f pnpm-workspace.yaml

RUN node_modules/.bin/nest build

# Verificar que dist/main.js existe — falla el build si no está
RUN test -f dist/main.js && echo "✓ dist/main.js generado" || (echo "✗ dist/main.js NO encontrado" && ls -la dist/ && exit 1)


# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copiar solo lo necesario para runtime
COPY package.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Verificar antes de cambiar usuario
RUN test -f dist/main.js && echo "✓ dist/main.js en runner" || (echo "✗ FALTA dist/main.js" && exit 1)

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]