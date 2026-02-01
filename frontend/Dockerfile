FROM public.ecr.aws/docker/library/node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 3000
CMD ["bash", "-lc", "npm ci && npm run dev -- --host 0.0.0.0 --port 3000"]
