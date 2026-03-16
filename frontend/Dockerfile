FROM node:22-alpine

WORKDIR /app

ARG BACKEND_INTERNAL_URL=http://backend:8000/api/v1
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
