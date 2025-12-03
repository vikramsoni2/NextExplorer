FROM public.ecr.aws/docker/library/node:24-bookworm-slim AS base

WORKDIR /app

# Backend dependencies (production only)
FROM base AS backend_deps
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Frontend build (needs dev dependencies)
FROM base AS frontend_build
ENV NODE_ENV=development
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --sourcemap false

# Final runtime image
FROM base AS runtime
ENV NODE_ENV=production

# Create the baseline app user; UID/GID may be mutated at runtime via entrypoint.sh.
RUN groupadd --system appuser && \
    useradd --system --gid appuser --shell /bin/bash --create-home appuser

# Install runtime tooling (ffmpeg, gosu for UID remapping, ripgrep for searches, imagemagick for HEIC thumbnails).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg gosu ripgrep imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Make git metadata available at runtime for backend /api/features endpoint
ARG GIT_COMMIT=""
ARG GIT_BRANCH=""
ARG REPO_URL=""
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV REPO_URL=${REPO_URL}

# Bring in the backend source and production dependencies.
COPY --from=backend_deps /app/node_modules ./node_modules
COPY --from=backend_deps /app/package.json ./
COPY backend/src ./src

# Copy the built frontend assets only.
RUN mkdir -p src/public
COPY --from=frontend_build /app/frontend/dist/ ./src/public/

# Bootstrap entrypoint script responsible for dynamic user mapping.
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME ["/config", "/cache"]

EXPOSE 3000
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "src/app.js"]
