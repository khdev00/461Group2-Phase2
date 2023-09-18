import winston, { Logform } from 'winston'; //Logging library

const logLevels: { [key: number]: string }= {
    0: 'silent',
    1: 'info',
    2: 'debug',
}

const logLevels_ = {
    silent: 0,
    info: 1,
    debug: 2,
}

function getLogLevel() {
    const logLevel = Number(process.env.LOG_LEVEL);
    if (!logLevel) {
        // Default log level is 0
        return logLevels[0];
    }
    else if (logLevel > 2) {
        // Just for convenience, instead of panicking
        return logLevels[2];
    }
    else if (logLevel < 0) {
        // Also just for convenience, instead of panicking
        return logLevels[0];
    }

    return logLevels[logLevel];
}

function getLogPath() {
    const logPath = process.env.LOG_FILE;
    if (!logPath) {
        const error = new Error("Could not find LOG_FILE path, please make sure it is valid");
        console.error(`Error: ${error}`);
        throw error;
    }

    return logPath;
}

export function getLogger() {
    const logLevel = getLogLevel();
    const logPath = getLogPath();
    
    const logger = winston.createLogger({
        level: logLevel,
        format: winston.format.simple(),
        transports: [
          new winston.transports.File({ filename: 'error.log', level: 'error' }),   // Temporary to catch errors
          new winston.transports.File({ filename: logPath, level: logLevel }),   // Actual log file
        ],
      });

    return logger;
}