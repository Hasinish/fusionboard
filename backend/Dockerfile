FROM node:20

# Install all supported languages and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    g++ \
    default-jdk \
    golang-go \
    rustc \
    build-essential \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && apt-get clean

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5001

CMD ["node", "src/server.js"]
