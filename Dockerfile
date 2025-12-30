FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

# Create data directory just in case
RUN mkdir -p data

EXPOSE 3000

CMD ["npm", "start"]
