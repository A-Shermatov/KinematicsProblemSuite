# syntax=docker/dockerfile:1
# Один Dockerfile для обоих приложений: --build-arg APP=web | admin
FROM node:22-alpine AS build
ARG APP=web
ARG VITE_ADMIN_URL=http://localhost:8081
ARG VITE_PUBLIC_URL=http://localhost:8080
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL VITE_PUBLIC_URL=$VITE_PUBLIC_URL
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build -w @kps/$APP

FROM nginx:1.27-alpine
ARG APP=web
COPY nginx/$APP.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/$APP/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
