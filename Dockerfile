# Use Node.js 18 as the base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat build-base python3
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Make scripts executable before running them
RUN chmod +x ./scripts/*.sh

# Generate Prisma client
RUN npx prisma generate

# Install bash for scripts
RUN apk add --no-cache bash

# Build the application with force option to bypass dependency errors
RUN npm run build:production:force

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

# Copy worker and scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/ecosystem.production.config.cjs ./

# Install bash for scripts
RUN apk add --no-cache bash

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --only=production

# Generate Prisma client in production
RUN npx prisma generate

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Install PM2 globally
RUN npm install -g pm2

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Use PM2 to start both the app and worker
CMD ["pm2-runtime", "ecosystem.production.config.cjs"]