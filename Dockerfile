FROM node:10.15.3-alpine as builder

RUN mkdir -p /root/src/app
WORKDIR /root/src/app
ENV PATH /root/src/app/node_modules/.bin:$PATH

COPY . .

RUN npm install

EXPOSE 3000

ENTRYPOINT ["npm","run","start"]

# This is docker build command: 
# docker build -t fptu-mark .

# This is docker run command:
# docker run -it --name fptu-mark fptu-mark