# Base stage
FROM node:20-slim AS base
WORKDIR /app
RUN npm install -g npm@latest

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# Install dependencies
RUN npm ci

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend
WORKDIR /app/apps/frontend
RUN npm run build

# Production stage (using Nginx to serve static files)
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Create env.sh script to generate config.js at runtime
WORKDIR /usr/share/nginx/html
RUN echo "#!/bin/sh" > env.sh && \
    echo "echo \"window.ENV = {\" > config.js" >> env.sh && \
    echo "env | grep '^VITE_' | sed 's/^\([^=]*\)=\(.*\)\$/  \1: \"\2\",/' >> config.js" >> env.sh && \
    echo "echo \"};\" >> config.js" >> env.sh && \
    chmod +x env.sh

EXPOSE 80

CMD ["/bin/sh", "-c", "./env.sh && nginx -g 'daemon off;'"]
