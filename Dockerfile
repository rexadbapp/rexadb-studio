FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN addgroup --system --gid 1001 rexadb && \
    adduser --system --uid 1001 rexadb

COPY --from=builder --chown=rexadb:rexadb /app/.next/standalone ./
COPY --from=builder --chown=rexadb:rexadb /app/.next/static ./.next/static
COPY --from=builder --chown=rexadb:rexadb /app/drizzle ./drizzle
COPY --from=builder --chown=rexadb:rexadb /app/drizzle.config.ts ./
COPY --from=builder --chown=rexadb:rexadb /app/package.json ./
COPY --from=builder --chown=rexadb:rexadb /app/node_modules ./node_modules
COPY --from=builder --chown=rexadb:rexadb /app/src ./src
COPY --from=builder --chown=rexadb:rexadb /app/tsconfig.json ./
COPY --chown=rexadb:rexadb entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER rexadb

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/rexadb.db"

ENTRYPOINT ["/app/entrypoint.sh"]
