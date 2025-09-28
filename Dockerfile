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
ENV UID=1000
ENV GID=1000
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=backend-deps /app ./
COPY --from=frontend-builder /frontend/dist ./public
EXPOSE 3000
CMD ["node", "app.js"]
