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

    green: function(string) { return { string, color: 'green' }; },
    red: function(string) { return { string, color: 'red' }; },
    blue: function(string) { return { string, color: 'blue' }; },
    yellow: function(string) { return { string, color: 'yellow' }; },
    magenta: function(string) { return { string, color: 'magenta' }; }
  };
};
