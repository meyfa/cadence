ARG BUILDPLATFORM

# build
FROM --platform=$BUILDPLATFORM node:lts-alpine AS build
WORKDIR /app

COPY package*.json ./

COPY packages/app/package*.json ./packages/app/
COPY packages/core/package*.json ./packages/core/
COPY packages/editor/package*.json ./packages/editor/
COPY packages/language/package*.json ./packages/language/

RUN npm ci

COPY . ./
RUN npm run build


# deploy
FROM nginx:stable-alpine AS deploy
WORKDIR /usr/share/nginx/html

COPY --from=build /app/packages/app/dist ./

EXPOSE 80
