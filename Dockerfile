# Use Node.js 18 as the base image
FROM node:18-alpine AS base

# Install system dependencies in one layer
RUN apk add --no-cache bash libc6-compat curl

# Set working directory
WORKDIR /app

# Create non-root user early
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files and npm config
COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (use .dockerignore to exclude unnecessary files)
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Generate Prisma client
RUN npx prisma generate

# Build the application (Next.js)
RUN npm run build:railway

# Build the worker bundle (TypeScript -> dist)
RUN npm run build:worker

# Clean up build artifacts to reduce image size
RUN rm -rf .next/cache

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create necessary directories with correct permissions
RUN mkdir -p .next logs uploads && \
    chown -R nextjs:nodejs .next logs uploads

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy compiled worker and library output
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Copy PM2 config and scripts
COPY --from=builder /app/ecosystem.production.config.cjs ./
COPY --from=builder /app/scripts ./scripts

# Copy package files for production dependencies
COPY --chown=nextjs:nodejs package.json package-lock.json .npmrc ./

# Install production dependencies, PM2, and setup in one layer
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm install -g pm2 && \
    npx prisma generate && \
    npm cache clean --force

# Make scripts executable and set proper permissions
RUN chmod +x ./scripts/*.sh 2>/dev/null || true && \
    chmod +x ./scripts/*.js 2>/dev/null || true && \
    chown -R nextjs:nodejs /app

# Verify critical files exist and show directory structure for debugging
RUN ls -la ecosystem.production.config.cjs && ls -la scripts/ && echo "Docker build verification complete"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Use PM2 startup script to start both the app and worker
CMD ["./scripts/start-pm2.sh"]