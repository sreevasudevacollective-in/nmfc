# Build context is the repo root, not apps/api — npm workspaces need the root
# lockfile and every workspace package.json present to resolve correctly.

FROM node:22-alpine AS build
WORKDIR /repo

# openssl is required by Prisma at generate time
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

# @nmfc/shared resolves to packages/shared/dist, so it must be compiled before the API
# is. (.dockerignore strips **/dist from the build context, so it is never prebuilt.)
RUN npm run build --workspace=packages/shared

WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /repo

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# PORT is deliberately not set. Cloud Run injects it at runtime, and a baked-in value
# here would just be a misleading default that the platform overrides. The app falls
# back to 4000 when PORT is absent, which is what a plain `docker run` gets.

# Dev dependencies are kept deliberately: the Prisma CLI is needed for
# `migrate deploy`, which Fly runs as a release_command before cutover.
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
