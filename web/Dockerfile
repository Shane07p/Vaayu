FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: no dependency executes code during the image build. The one
# package wanting a postinstall (unrs-resolver) is a lint-time native binding
# that next build does not need.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
# next start serves this directory verbatim. Without it every static asset
# 404s: the basemap style, the geographic reference JSON the citizen map's
# markers are built from, and the AQI band images. The failure is silent --
# the map initialises, reports no error, and renders an empty canvas.
COPY --from=build /app/public ./public

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]
