# =============================================================================
# Dockerfile — organizaciones-back
# Stack: Node 22 · pnpm · NestJS 11 · Prisma 7
# =============================================================================

# ── Stage 1: dependencias completas ──────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Compilar bcrypt (binding nativo)
RUN cd node_modules/bcrypt && npm rebuild bcrypt --build-from-source || true

# Generar Prisma Client
RUN npx prisma generate


# ── Stage 2: compilar TypeScript ─────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY . .

# Excluir pnpm-workspace.yaml si existe (evita modo monorepo)
RUN rm -f pnpm-workspace.yaml

# Compilar usando nest directamente, sin pasar por pnpm workspace
RUN npx nest build


# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY prisma ./prisma/

# node_modules con prisma client ya generado
COPY --from=deps /app/node_modules ./node_modules

# build compilado
COPY --from=builder /app/dist ./dist

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]