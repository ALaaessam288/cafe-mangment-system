FROM node:20-alpine

WORKDIR /app

# Dependencies first so a change to server.js does not re-install 180 packages.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./

# The linked-device credentials live here. On Railway this MUST be a mounted volume: without one
# the directory is part of the container filesystem, every deploy starts with an empty auth state,
# and the number has to be re-linked by QR each time.
ENV AUTH_DIR=/data/auth
RUN mkdir -p /data/auth

EXPOSE 8080
CMD ["node", "server.js"]
