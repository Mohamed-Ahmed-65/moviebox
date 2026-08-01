FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application files
COPY . .

# Hugging Face Spaces defaults to exposing port 7860
ENV PORT=7860
EXPOSE 7860

# Start the server
CMD ["node", "server.js"]
