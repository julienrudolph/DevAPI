FROM node:22.22.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --ignore-scripts \
      --workspace @api-client/contracts \
      --workspace @api-client/api \
      --include-workspace-root=false \
  && npm run build --workspace @api-client/contracts \
  && npm run build --workspace @api-client/api \
  && npm prune --omit=dev

FROM node:22.22.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts ./packages/contracts
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
