FROM node:16-alpine

# Install curl and other dependencies
RUN apk update && apk add --no-cache curl python3 make g++

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --build-from-source
COPY . .
EXPOSE 4000
CMD ["node", "app.js"]