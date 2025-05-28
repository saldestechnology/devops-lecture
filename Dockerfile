# 1. Base Image - Use an official Node.js runtime
FROM node:18-alpine AS base

# 2. Set Environment Variables
ENV NODE_ENV=production
# APP_VERSION can be overridden at build time or runtime
ARG APP_VERSION_ARG=1.0.0
ENV APP_VERSION=${APP_VERSION_ARG}

# 3. Create a non-root user and group for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

# 4. Copy package files and install dependencies
# Only copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies only and clean cache
RUN npm ci --only=production && npm cache clean --force

# 5. Switch to the non-root user
USER appuser

# 6. Copy application source code
# Ensure files are owned by the non-root user
COPY --chown=appuser:appgroup . .

# 7. Expose the application port
EXPOSE 8080

# 8. Define the command to run the application
# Using exec form (JSON array) for proper signal handling
CMD [ "node", "server.js" ]