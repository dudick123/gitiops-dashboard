# Frontend — GitOps Dashboard
# TECH-STANDARDS §5, §12.6, §12.12
# TODO: Replace with digest-pinned images
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- Final stage ---
FROM nginx:alpine

# Create non-root user
RUN addgroup -g 1000 frontend && \
    adduser -u 1000 -G frontend -s /bin/sh -D frontend

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Security headers nginx config (TECH-STANDARDS §12.12)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

USER frontend

CMD ["nginx", "-g", "daemon off;"]
