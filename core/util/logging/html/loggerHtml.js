const path = require('path');
const TemplateGenerator = require('./templateGenerator');

function getPath (config) {
  function toAbsolute (p) {
    return (path.isAbsolute(p)) ? p : path.join(config.projectPath, p);
  }

  return toAbsolute(config.html_report + '/log.html');

  // console.log(config.bitmaps_test, config.screenshotDateTime);
  // console.log(JSON.stringify(config, null, '\t'));
  // console.log(config.bitmaps_test, config.screenshotDateTime);
  // const reportPath = toAbsolute(config.bitmaps_test + '/' + config.screenshotDateTime + '/log.html');
}

function init (reportPath, config) {
  const gen = new TemplateGenerator(reportPath);
  gen.init(config.id || 'Backstop');
}

const typeToColor = {
  error: 'lightcoral',
  warn: 'yellow',
  log: 'transparent',
  info: 'lightgrey',
  debug: 'blue',
  success: 'lightgreen'
};

function logEither (reportPath, color, message, context) {
  const gen = new TemplateGenerator(reportPath);
  gen.load();

  if (context && context.scenario) {
    gen.addContext(color, message, context);
  } else {
    gen.addMessage(color, message);
  }

  gen.save();
}

function message (reportPath, type, subject, string, context) {
  if (!typeToColor.hasOwnProperty(type)) {
    type = 'info';
    logEither(reportPath, typeToColor.warn, 'Type ' + type + ' is not defined as logging type', context);
  }

  let color;
  if (string && string.color) {
    // then it is { string, color }
    color = string.color.replace('green', 'lightgreen');
    string = string.string;
  }

  if (!subject) {
    logEither(reportPath, color || typeToColor[type], string, context);
    return;
  }

  logEither(reportPath, color || typeToColor[type], subject + ' | ' + string, context);
}

function end (reportPath) {
  const gen = new TemplateGenerator(reportPath);
  gen.end();
}

module.exports = function (config, subject) {
  const reportPath = getPath(config);
  // console.log('HTML report is saved to ' + reportPath);

  return {
    error: message.bind(null, reportPath, 'error', subject),
    warn: message.bind(null, reportPath, 'warn', subject),
    log: message.bind(null, reportPath, 'log', subject),
    info: message.bind(null, reportPath, 'info', subject),
    debug: message.bind(null, reportPath, 'debug', subject),
    success: message.bind(null, reportPath, 'success', subject),
    init: init.bind(null, reportPath, config),
    end: end.bind(null, reportPath)
  };
};
