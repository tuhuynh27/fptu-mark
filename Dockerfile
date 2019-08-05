FROM buildkite/puppeteer:latest

RUN mkdir -p /root/src/app
WORKDIR /root/src/app
ENV PATH /root/src/app/node_modules/.bin:$PATH

COPY package.json yarn.lock ./
RUN npm install

COPY . .

ENTRYPOINT ["node","index.js", "data.yml"]