# ──────────────────────────────────────────────────────────
# AuraOS Frontend — Multi-stage build
# Stage 1: Build the React app with Vite
# Stage 2: Serve the static bundle with NGINX
# ──────────────────────────────────────────────────────────

# ── Build Stage ──
FROM node:20-alpine AS builder

WORKDIR /build

# Copy entire monorepo context (needed for file:.. workspace link)
COPY package.json ./
COPY frontend/ ./frontend/

WORKDIR /build/frontend

# Install dependencies (the file:.. link resolves to /build/package.json)
RUN npm install --legacy-peer-deps

# Build the Vite production bundle
ENV VITE_AUDIO_WS_URL=""
RUN npm run build

# ── Serve Stage ──
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom NGINX config with reverse proxy to backend containers
RUN cat > /etc/nginx/conf.d/aura.conf << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # API proxy → Node backend
    location /api/v1/ {
        proxy_pass http://aura-python:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 30s;
    }

    location /api/ {
        proxy_pass http://aura-node:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
    }

    # WebSocket proxy → Python backend
    location /ws/ {
        proxy_pass http://aura-python:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# Copy built assets from builder stage
COPY --from=builder /build/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
