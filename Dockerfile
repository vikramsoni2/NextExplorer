FROM public.ecr.aws/docker/library/node:24-bookworm-slim

# Create the baseline app user; UID/GID may be mutated at runtime via entrypoint.sh.
RUN groupadd --system appuser && \
    useradd --system --gid appuser --shell /bin/bash --create-home appuser

# Install runtime tooling (ffmpeg, gosu for UID remapping, ripgrep for searches, imagemagick for HEIC thumbnails).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg gosu ripgrep imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build-time git metadata (passed from CI via --build-arg)
ARG GIT_COMMIT=""
ARG GIT_BRANCH=""
ARG REPO_URL=""

# Install backend dependencies first to take advantage of Docker layer caching.
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Bring in the backend source and ensure only production dependencies remain.
COPY backend/ ./
RUN npm prune --omit=dev

# Prepare the frontend build; retain only the generated dist assets.
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Build the frontend with the backend's package.json version baked in
# Vite reads VITE_APP_VERSION in vite.config.js to inject __APP_VERSION__
RUN VITE_APP_VERSION=$(node -p "require('/app/package.json').version") \
  VITE_GIT_COMMIT=${GIT_COMMIT} \
  VITE_GIT_BRANCH=${GIT_BRANCH} \
  VITE_REPO_URL=${REPO_URL} \
  npm run build -- --sourcemap false \
  && rm -rf node_modules \
  && npm cache clean --force

WORKDIR /app
RUN mkdir -p public \
  && cp -r frontend/dist/. public \
  && rm -rf frontend \
  && npm cache clean --force

# Bootstrap entrypoint script responsible for dynamic user mapping.
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME ["/config", "/cache"]

ENV NODE_ENV=production

EXPOSE 3000
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "app.js"]
