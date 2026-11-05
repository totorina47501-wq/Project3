# Construire depuis la racine du dépôt : aucune clé dans les couches de l'image.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir /work && chown node:node /work && chmod 700 /work
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY workers/media-jobs/src ./workers/media-jobs/src
COPY workers/video/src ./workers/video/src
COPY workers/carousel/src ./workers/carousel/src
USER node
ENV MEDIA_RUNNER_ENABLED=false MEDIA_RUNNER_WORK_ROOT=/work MEDIA_RUNNER_POLL_MS=5000
STOPSIGNAL SIGTERM
CMD ["node", "workers/media-jobs/src/remote-run.mjs"]
