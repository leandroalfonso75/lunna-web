# Mesmo formato do timeia: build com npm ci, runtime só com .output (Nitro), usuário 1001.
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production-stage
RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001
WORKDIR /app
COPY --from=build-stage --chown=nuxt:nodejs /app/.output /app/.output
USER nuxt
EXPOSE 3000
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
