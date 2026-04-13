# ──────────────────────────────────────────────────────────
# AuraOS Node.js Backend
# Express + LangChain + Groq + MongoDB + Clinical RAG
# ──────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /build

# Copy monorepo root package.json (needed for file:.. workspace link)
COPY package.json ./
COPY backend-node/ ./backend-node/

WORKDIR /build/backend-node

# Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Expose the API port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:5001/health || exit 1

# Start the server
CMD ["node", "server.js"]
