// Vad är devops i form av
// livscykelhantering av
// programvara.

const express = require('express');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const path = require("node:path");

const PORT = process.env.PORT || 8080;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const APP_VERSION = process.env.APP_VERSION || '0.0.0-local';

const logger = pino({
  level: LOG_LEVEL,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

const app = express();

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "'unsafe-inline'"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'"
      ],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

app.use(pinoHttp({ logger }));
app.use(pinoHttp({ logger }));

app.get('/', (req, res) => {
  req.log.info({ action: 'render-homepage', app_version: APP_VERSION }, 'Homepage accessed');
  res.sendFile(path.resolve("static", "index.html"))
});

app.get('/health', (req, res) => {
  const healthStatus = { status: 'UP', version: APP_VERSION, timestamp: new Date().toISOString() };
  res.status(200).send(healthStatus);
});

app.get('/error-test', (req, res, next) => {
  try {
    throw new Error('This is a test error for logging!');
  } catch (error) {
    req.log.error({ err: error, custom_info: 'Error in /error-test' }, 'Test error triggered');
    res.status(500).send({ message: 'An intentional error occurred!', error: error.message });
  }
});

app.use((err, req, res, next) => {
  req.log.error({ err: err }, 'Unhandled error caught by middleware');
  res.status(500).send({ message: 'Something broke unexpectedly!', error: err.message });
});

const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}. Version: ${APP_VERSION}. NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

const gracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed. Exiting process.');

    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   