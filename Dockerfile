# Multi-stage image that builds the frontend and serves it through the backend
FROM public.ecr.aws/docker/library/node:lts-bookworm AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --sourcemap false

FROM public.ecr.aws/docker/library/node:lts-bookworm AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
RUN npm prune --omit=dev

FROM public.ecr.aws/docker/library/node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# Pre-create the application user; UID/GID will be adjusted at runtime.
RUN groupadd --system appuser && \
    useradd --system --gid appuser --shell /bin/bash --create-home appuser

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg gosu \
  && rm -rf /var/lib/apt/lists/*
COPY --from=backend-deps /app ./
COPY --from=frontend-builder /frontend/dist ./public

# Bootstrap entrypoint script responsible for dynamic user mapping.
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "app.js"]
