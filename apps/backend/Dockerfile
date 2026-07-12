# Base stage
FROM node:20-slim AS base
WORKDIR /app
# Pin to the latest npm major compatible with Node 20. npm@latest (12.x) now
# requires Node >=22 and breaks the build with EBADENGINE on node:20-slim.
RUN npm install -g npm@11

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install dependencies
RUN npm ci

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend

EXPOSE 4300

CMD ["npm", "start"]
