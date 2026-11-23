# Site Ofertaço Radar — Next.js standalone
# Build:  docker build -f deploy/site/Dockerfile -t ofertacoradar-site .
# Run:    docker compose -f deploy/site/docker-compose.yml up -d

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# openssl p/ engines do Prisma + schema p/ o postinstall (prisma generate)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate precisa do schema; .env nao e necessario no build.
# DATABASE_URL dummy: o "collect page data" instancia o PrismaClient
# (so valida formato da URL — nao conecta de verdade).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npx prisma generate && \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone traz server.js + node_modules minimo; copia public e .next/static
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
