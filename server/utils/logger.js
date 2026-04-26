// Structured logging with Pino
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

const loggerConfig = {
  level: logLevel,
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: pure JSON for maximum performance
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      }),
};

const logger = pino(loggerConfig);

export default logger;

