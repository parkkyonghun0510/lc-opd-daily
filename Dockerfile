# Use Node.js 18 as the base image
FROM node:18-alpine AS base

# Install system dependencies in one layer
RUN apk add --no-cache bash libc6-compat

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files and npm config
COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build:production

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy PM2 config and scripts
COPY --from=builder /app/ecosystem.production.config.cjs ./
COPY --from=builder /app/scripts ./scripts

# Install production dependencies, PM2, and setup in one layer
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm install -g pm2 && \
    npx prisma generate && \
    chmod +x ./scripts/*.sh 2>/dev/null || true && \
    chmod +x ./scripts/*.js 2>/dev/null || true && \
    mkdir -p logs && \
    chown -R nextjs:nodejs /app

# Verify critical files exist and show directory structure for debugging
RUN ls -la ecosystem.production.config.cjs && ls -la scripts/ && echo "Docker build verification complete"

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Use PM2 startup script to start both the app and worker
CMD ["./scripts/start-pm2.sh"]