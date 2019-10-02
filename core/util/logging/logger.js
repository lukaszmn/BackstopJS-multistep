module.exports = function (config, subject) {
  let logger;
  switch (config.logger) {
    case 'nil':
      logger = require('./loggerNil')(subject);
      break;

    case 'console':
      logger = require('./loggerConsole')(subject);
      break;

    case 'context':
      logger = require('./loggerContext')(subject);
      break;

    case 'html':
      logger = require('./html/loggerHtml')(config, subject);
      break;
  }

  return {
    error: logger.error,
    warn: logger.warn,
    log: logger.log,
    info: logger.info,
    debug: logger.debug,
    success: logger.success,
    init: logger.init,
    end: logger.end,

    green: function (string) { return { string, color: 'green' }; },
    red: function (string) { return { string, color: 'red' }; },
    blue: function (string) { return { string, color: 'blue' }; },
    yellow: function (string) { return { string, color: 'yellow' }; },
    magenta: function (string) { return { string, color: 'magenta' }; }
  };
};
