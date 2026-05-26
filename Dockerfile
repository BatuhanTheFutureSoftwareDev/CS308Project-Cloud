# --- Stage 1: build React frontend ---
FROM node:18 AS frontend
WORKDIR /frontend
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY public ./public
COPY src ./src
RUN npm run build

# --- Stage 2: backend runtime, with frontend build served as static files ---
FROM node:18-slim
WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/src ./src
COPY --from=frontend /frontend/build ./public

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001
CMD ["node", "src/index.js"]
