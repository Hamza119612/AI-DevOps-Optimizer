import pino from 'pino';

// Define the log level based on the environment variable, defaulting to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Check if pino-pretty is available at runtime (it won't be in pruned container images)
let canUsePretty = false;
try {
  require.resolve('pino-pretty');
  canUsePretty = process.env.NODE_ENV !== 'production';
} catch (e) {
  canUsePretty = false;
}

// Configure the Pino logger
const logger = pino({
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  ...(canUsePretty && {
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

export default logger;

