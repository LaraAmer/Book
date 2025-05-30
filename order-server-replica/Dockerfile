# Use a Node.js image as the base
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Expose the port
EXPOSE 4001

# Command to run the app
CMD ["node", "./order-replica.js"]