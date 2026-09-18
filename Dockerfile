FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
