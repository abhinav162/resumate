# Builder stage
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend-v2 ./apps/frontend-v2

# Install all workspace deps (needed for monorepo resolution)
RUN npm ci --workspace=apps/frontend-v2

# Build
WORKDIR /app/apps/frontend-v2
RUN npm run build

# Production stage — Nginx serves the static build
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend-v2/dist /usr/share/nginx/html
COPY apps/frontend-v2/nginx.conf /etc/nginx/conf.d/default.conf

# Runtime env injection: env.sh writes window.ENV = { VITE_*: "..." } to config.js
# so env vars can be changed on the server without rebuilding the image
WORKDIR /usr/share/nginx/html
RUN echo "#!/bin/sh" > env.sh && \
    echo "echo \"window.ENV = {\" > config.js" >> env.sh && \
    echo "env | grep '^VITE_' | sed 's/^\([^=]*\)=\(.*\)\$/  \1: \"\2\",/' >> config.js" >> env.sh && \
    echo "echo \"};\" >> config.js" >> env.sh && \
    chmod +x env.sh

EXPOSE 80

CMD ["/bin/sh", "-c", "./env.sh && nginx -g 'daemon off;'"]
