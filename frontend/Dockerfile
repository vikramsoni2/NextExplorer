FROM public.ecr.aws/docker/library/node:20-bookworm
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 3000
CMD ["bash", "-lc", "npm ci && npm run dev -- --host 0.0.0.0 --port 3000"]
