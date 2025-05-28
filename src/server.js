const express = require('express');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const APP_VERSION = process.env.APP_VERSION || '0.0.0-local'; // Set via env var in deployment

// --- Logger ---
const logger = pino({
  level: LOG_LEVEL,
  ...(process.env.NODE_ENV !== 'production' && { // Pretty print for local dev if NODE_ENV is not 'production'
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

// --- Express App Setup ---
const app = express();

// --- Middlewares ---
app.use(helmet()); // Basic security headers
app.use(pinoHttp({ logger })); // Structured request logging

// --- Routes ---
app.get('/', (req, res) => {
  req.log.info({ action: 'render-homepage', app_version: APP_VERSION }, 'Homepage accessed');
  res.send(`Hello DevOps World! App Version: ${APP_VERSION}. Deployed on Google Cloud Run! 🚀`);
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

// --- Error Handling Middleware (Keep as last middleware) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.log.error({ err: err }, 'Unhandled error caught by middleware');
  res.status(500).send({ message: 'Something broke unexpectedly!', error: err.message });
});

// --- Server Start ---
const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}. Version: ${APP_VERSION}. NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed. Exiting process.');
    // Add any cleanup here (e.g., close database connections)
    process.exit(0);
  });

  // Force shutdown if server hasn't closed in time
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000); // 10 seconds timeout
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Sent by Cloud Run, Kubernetes
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C in terminal