FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV NODE_ENV=production

# Start
CMD ["npm", "start"]
