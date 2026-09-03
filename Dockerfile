FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @narada/web build

FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY --from=build /app ./

ENV NODE_ENV=production
ENV WEB_DIST=/app/apps/web/dist
USER node
CMD ["pnpm", "--filter", "@narada/api", "start"]
