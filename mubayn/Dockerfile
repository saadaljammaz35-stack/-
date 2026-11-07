# Container alternative to Vercel (Render, Fly.io, Railway, AWS ECS ...).
# Chromium and ffmpeg come from the OS, so the PDF and video paths do not
# depend on serverless-specific binaries.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg fonts-noto-core ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    PORT=3000
COPY --from=build /app ./
RUN useradd --system --uid 1001 mubayn && chown -R mubayn /app
USER mubayn
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://localhost:3000/api/health || exit 1
CMD ["sh", "-c", "npx next start -p ${PORT}"]
