# base layer: node 24 + pnpm, shared by every stage below
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# prune stage: turbo figures out exactly which files "api" actually needs
# (its own source plus only the workspace packages it depends on) and
# writes a minimal copy of the monorepo to /app/out
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.12 prune api --docker

# install stage: install deps first using only the pruned package.json files
# (this is what makes docker layer caching actually work - deps only
# reinstall when a package.json changes, not on every source edit)
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# now bring in the real source code
COPY --from=pruner /app/out/full/ .
# prisma generate only reads the schema, it never connects to a real database -
# but env() throws if the variable is missing entirely, so a placeholder is enough
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter api exec prisma generate
RUN pnpm turbo run build --filter=api

# runner stage: only what's needed to actually run the compiled app
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app .
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]