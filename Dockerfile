FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
