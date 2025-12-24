# syntax=docker/dockerfile:1.20

ARG BUILDPLATFORM

# build
FROM --platform=$BUILDPLATFORM node:lts-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY --parents ./packages/*/package*.json ./

RUN npm ci

COPY . ./
RUN npm run build


# deploy
FROM nginx:stable-alpine AS deploy
WORKDIR /usr/share/nginx/html

COPY --from=build /app/packages/app/dist ./

EXPOSE 80
