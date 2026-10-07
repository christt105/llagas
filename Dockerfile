FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION NODE_ENV=production DATA_DIR=/data STATIC_DIR=/app/dist PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://localhost:8080/api/config > /dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
