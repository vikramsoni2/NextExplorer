FROM public.ecr.aws/docker/library/node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ripgrep \
    imagemagick \
    curl \
    unzip \
    openssh-client \
    libva-drm2 \
    libva2 \
    mesa-va-drivers \
    vainfo \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -T 2 -t 1 -O /dev/null "http://127.0.0.1:${PORT:-3001}/healthz" || exit 1
CMD ["bash", "-lc", "npm ci && npm run start"]