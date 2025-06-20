# Use Node.js 18 as the base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
<<<<<<< Updated upstream
RUN apk add --no-cache libc6-compat
=======
RUN apk add --no-cache libc6-compat build-base python3 vips-dev
>>>>>>> Stashed changes
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
<<<<<<< Updated upstream
=======
# Skip husky install during npm ci
ENV HUSKY=0
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
>>>>>>> Stashed changes
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

<<<<<<< Updated upstream
=======
# Make scripts executable before running them
RUN chmod +x ./scripts/build/*.sh
RUN chmod +x ./scripts/deploy/*.sh
RUN chmod +x ./scripts/db/*.sh

>>>>>>> Stashed changes
# Generate Prisma client
RUN npx prisma generate

# Build the application with force option to bypass dependency errors
RUN npm run build:production

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Install required libraries for image processing
RUN apk add --no-cache vips-dev

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

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Generate Prisma client in production
RUN npx prisma generate

# Make scripts executable
RUN chmod +x ./scripts/build/*.sh
RUN chmod +x ./scripts/deploy/*.sh
RUN chmod +x ./scripts/db/*.sh

# Install PM2 globally
RUN npm install -g pm2

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Use PM2 to start both the app and worker
CMD ["pm2-runtime", "ecosystem.production.config.cjs"]