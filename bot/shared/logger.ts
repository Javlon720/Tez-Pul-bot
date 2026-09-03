'use strict';

import { createLogger, format, transports } from 'winston';
import type { Logger } from 'winston';

const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `[${String(timestamp)}] ${level.toUpperCase()}: ${String(message)}`)
  ),
  transports: [new transports.Console()],
});

export default logger;
