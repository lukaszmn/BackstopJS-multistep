module.exports = function (config, subject) {

  let logger;
  switch (config.logger) {

    case 'console':
      logger = require('./loggerConsole')(subject);
      break;

    case 'nil':
      logger = require('./loggerNil')(subject);
      break;

  }

  return {
    error: logger.error,
    warn: logger.warn,
    log: logger.log,
    info: logger.info,
    debug: logger.debug,
    success: logger.success,

    green: logger.green,
    red: logger.red
  };
};
