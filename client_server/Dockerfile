FROM node:16-alpine  
WORKDIR /usr/src/app
RUN apk update && apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --build-from-source
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]