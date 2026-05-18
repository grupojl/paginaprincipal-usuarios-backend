# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma/
# ← NO copiar prisma.config.ts aquí, el compilador la pickup y rompe rootDir
COPY . .
RUN rm -f prisma.config.ts  # eliminarla ANTES del build
RUN rm -f pnpm-workspace.yaml

RUN node_modules/.bin/nest build

RUN test -f dist/main.js && echo "✓ dist/main.js generado" || (echo "✗ dist/main.js NO encontrado" && ls -la dist/ && exit 1)


# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./          # ← aquí sí, el runner la necesita para prisma migrate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN test -f dist/main.js && echo "✓ dist/main.js en runner" || (echo "✗ FALTA dist/main.js" && exit 1)

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]