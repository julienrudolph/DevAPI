FROM node:22.22.0-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_OIDC_PROVIDER
ARG VITE_OIDC_LABEL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_OIDC_PROVIDER=$VITE_OIDC_PROVIDER
ENV VITE_OIDC_LABEL=$VITE_OIDC_LABEL

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --ignore-scripts \
  && npm run build --workspace @api-client/contracts \
  && npm run build --workspace @api-client/web

FROM nginx:1.28-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
