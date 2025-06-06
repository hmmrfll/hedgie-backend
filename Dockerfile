FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${BACKEND_LOCAL_PORT}
CMD ["sh", "-c", "npx sequelize-cli db:migrate && npm start"]
