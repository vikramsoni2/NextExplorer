FROM public.ecr.aws/docker/library/node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 3000
CMD ["bash", "-lc", "npm ci && npm run start"]
