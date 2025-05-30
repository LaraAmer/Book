# Use the official Node.js image
FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install 

# Bundle app source
COPY . .

# Expose the port
EXPOSE 3000

# Command to run the app
CMD ["node", "./app.js"]