FROM public.ecr.aws/docker/library/node:20-bookworm
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 5173
CMD ["bash", "-lc", "npm ci && npm run dev -- --host 0.0.0.0"]
