FROM public.ecr.aws/docker/library/node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ripgrep imagemagick curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-3001}/healthz" || exit 1

CMD ["bash", "-lc", "npm ci && npm run start"]
