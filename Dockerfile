# =============================================================================
# Dockerfile — organizaciones-back
# Stack: Node 22 · pnpm · NestJS 11 · Prisma 7
# Build: multi-stage (deps → builder → runner)
# =============================================================================

# ── Stage 1: instalar dependencias ───────────────────────────────────────────
FROM node:22-alpine AS deps

# Necesario para bcrypt y otros bindings nativos
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar manifests y schema de Prisma ANTES del install
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile


# ── Stage 2: compilar TypeScript ─────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY . .

# 1. Generar el Prisma Client con los tipos del schema actual
RUN pnpm prisma generate

# 2. Compilar TypeScript → dist/
RUN pnpm run build


# ── Stage 3: imagen de runtime (mínima) ──────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Generar Prisma Client en el runner también
RUN pnpm prisma generate

COPY --from=builder /app/dist ./dist

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]