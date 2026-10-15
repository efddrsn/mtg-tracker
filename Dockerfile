FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/store-python && /opt/store-python/bin/pip install --no-cache-dir curl_cffi==0.16.3
ENV STORE_PYTHON=/opt/store-python/bin/python
ENV STORE_TLS_ENABLED=true
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
