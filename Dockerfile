FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server ./server

# Create non-root user matching NAS turbo user (uid=1030, gid=100)
RUN addgroup -g 100 users 2>/dev/null || true && \
    adduser -u 1030 -G users -D turbo

# Create directories for data and uploads
RUN mkdir -p /data /uploads && \
    chown -R turbo:users /app /data /uploads

# Set environment
ENV NODE_ENV=production

# Run as turbo user
USER turbo

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server/index.js"]
