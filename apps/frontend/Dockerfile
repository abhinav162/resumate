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

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
