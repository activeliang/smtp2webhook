FROM node:16.18-alpine3.15

RUN set -eux & apk add --no-cache yarn
WORKDIR /app
COPY package* ./
COPY yarn.loc* ./
RUN yarn config set registry https://registry.npmmirror.com

COPY enterpoint.sh ./
RUN chmod +x ./enterpoint.sh

COPY dev ./dev
COPY src ./src
RUN mkdir -p /app/log
RUN yarn install

CMD ["/app/enterpoint.sh"]