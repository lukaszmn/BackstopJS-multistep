var chalk = require('chalk');

let logger;

function getMessage (string, context) {
  if (!context) {
    return string;
  }

  if (context) {
    return string + chalk.bgCyan('  // ' + JSON.stringify(context));
  }
}

module.exports = function (subject) {
  logger = require('./loggerConsole')(subject);

  return {
    error: function (string, context) { logger.error(getMessage(string, context)); },
    warn: function (string, context) { logger.warn(getMessage(string, context)); },
    log: function (string, context) { logger.log(getMessage(string, context)); },
    info: function (string, context) { logger.info(getMessage(string, context)); },
    debug: function (string, context) { logger.debug(getMessage(string, context)); },
    success: function (string, context) { logger.success(getMessage(string, context)); }
  };
};
