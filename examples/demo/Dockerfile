# Build the library and run one demo service.
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/delete-guard/package.json packages/delete-guard/
COPY examples/demo/services/orders/package.json examples/demo/services/orders/
COPY examples/demo/services/reviews/package.json examples/demo/services/reviews/
COPY examples/demo/services/customers/package.json examples/demo/services/customers/
RUN npm install

COPY tsconfig.base.json ./
COPY packages ./packages
COPY examples ./examples
RUN npm run build

ARG SERVICE_DIR
ENV SERVICE_DIR=${SERVICE_DIR}
WORKDIR /app/${SERVICE_DIR}
CMD ["node", "index.js"]
