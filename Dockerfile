# =============================================================================
# Dockerfile — organizaciones-back
# Stack: Node 22 · pnpm · NestJS 11 · Prisma 7
# =============================================================================

# ── Stage 1: dependencias ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma/

# --ignore-scripts evita el error de builds no aprobados
# prisma generate se corre explícitamente después
RUN pnpm install --frozen-lockfile --ignore-scripts

# Compilar bcrypt (binding nativo) explícitamente
RUN cd node_modules/bcrypt && npm rebuild bcrypt --build-from-source || true


# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY . .

# Generar Prisma Client y compilar
RUN pnpm prisma generate
RUN pnpm run build


# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat python3 make g++ dumb-init

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Rebuild bcrypt en el runner también
RUN cd node_modules/bcrypt && npm rebuild bcrypt --build-from-source || true

# Generar Prisma Client
RUN pnpm prisma generate

COPY --from=builder /app/dist ./dist

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]