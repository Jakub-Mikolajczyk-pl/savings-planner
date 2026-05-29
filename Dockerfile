FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_BACKEND=api
ARG VITE_API_BASE_URL=
ENV VITE_BACKEND=$VITE_BACKEND
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$API_TOKEN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
