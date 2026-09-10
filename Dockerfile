# syntax=docker/dockerfile:1
#
# Two targets, one file:
#   dev  — Vite with hot reload, source bind-mounted from the host
#   prod — the same static bundle Vercel ships, served by nginx
#
# Build one with `--target dev` / `--target prod`, or use docker-compose.yml.

# ---------------------------------------------------------------- dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


# ------------------------------------------------------------------------- dev
# node_modules lives in the image, not the bind mount, so the container never
# sees the host's Windows-built binaries. docker-compose.yml keeps it that way
# with an anonymous volume over /app/node_modules.
FROM node:22-alpine AS dev
WORKDIR /app
ENV VITE_POLLING=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ----------------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app
COPY . .
# Same command Vercel runs: typecheck, then bundle.
RUN npm run build


# ------------------------------------------------------------------------ prod
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
