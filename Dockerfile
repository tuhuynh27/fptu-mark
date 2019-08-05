FROM buildkite/puppeteer:latest

RUN mkdir -p /root/src/app
WORKDIR /root/src/app
ENV PATH /root/src/app/node_modules/.bin:$PATH

COPY package.json yarn.lock ./
RUN npm install

COPY . .

ENTRYPOINT ["node","index.js", "data.yml"]

# This is docker build command: 
# docker build -t fptu-mark .

# This is docker run command:
# docker run -it fptu-mark