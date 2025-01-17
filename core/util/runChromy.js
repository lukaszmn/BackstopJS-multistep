const Chromy = require('chromy');
// const writeFileSync = require('fs').writeFileSync;
const fs = require('./fs');
const path = require('path');
const ensureDirectoryPath = require('./ensureDirectoryPath');
const engineTools = require('./engineTools');

const MIN_CHROME_VERSION = 62;
const TEST_TIMEOUT = 30000;
// const CHROMY_STARTING_PORT_NUMBER = 9222;
const DEFAULT_FILENAME_TEMPLATE = '{configId}_{scenarioLabel}_{selectorIndex}_{selectorLabel}_{viewportIndex}_{viewportLabel}';
const DEFAULT_BITMAPS_REFERENCE_DIR = 'bitmaps_reference';
const SELECTOR_NOT_FOUND_PATH = '/capture/resources/notFound.png';
const HIDDEN_SELECTOR_PATH = '/capture/resources/notVisible.png';
const BODY_SELECTOR = 'body';
const DOCUMENT_SELECTOR = 'document';
const NOCLIP_SELECTOR = 'body:noclip';
const VIEWPORT_SELECTOR = 'viewport';

const injectBackstopTools = require('../../capture/backstopTools.js');
const BackstopException = require('../util/BackstopException.js');

module.exports = function (args) {
  const scenario = args.scenario;
  const viewport = args.viewport;
  const config = args.config;
  const runId = args.id;
  const assignedPort = args.assignedPort;
  const scenarioLabelSafe = engineTools.makeSafe(scenario.label);
  const variantOrScenarioLabelSafe = scenario._parent ? engineTools.makeSafe(scenario._parent.label) : scenarioLabelSafe;

  return processScenarioView(scenario, variantOrScenarioLabelSafe, scenarioLabelSafe, viewport, config, runId, assignedPort);
};

function getLoggerDebug (scenario, viewport) {
  return {
    scenario: scenario,
    viewport: viewport,
    stage: 'browser'
  };
}

/**
 * [processScenarioView description]
 * @param  {[type]} scenario               [description]
 * @param  {[type]} variantOrScenarioLabelSafe [description]
 * @param  {[type]} scenarioLabelSafe          [description]
 * @param  {[type]} viewport               [description]
 * @param  {[type]} config                 [description]
 * @return {[type]}                        [description]
 */
function processScenarioView (scenario, variantOrScenarioLabelSafe, scenarioLabelSafe, viewport, config, runId, assignedPort) {
  if (!config.paths) {
    config.paths = {};
  }

  if (typeof viewport.label !== 'string') {
    viewport.label = viewport.name || '';
  }

  const engineScriptsPath = config.env.engine_scripts || config.env.engine_scripts_default;
  const isReference = config.isReference;
  /**
   *  =============
   *  START CHROMY SESSION
   *  =============
   */
  const VP_W = viewport.width || viewport.viewport.width;
  const VP_H = viewport.height || viewport.viewport.height;

  const DEFAULT_CHROME_FLAGS = ['--disable-gpu', '--force-device-scale-factor=1', '--disable-infobars=true'];
  // const PORT = (config.startingPort || CHROMY_STARTING_PORT_NUMBER) + runId;
  const PORT = assignedPort;
  let defaultOptions = {
    chromeFlags: undefined,
    port: PORT,
    waitTimeout: TEST_TIMEOUT,
    visible: config.debugWindow || false
  };

  // This option is depricated.
  const chromeFlags = (Array.isArray(config.hostFlags) && config.hostFlags) || (Array.isArray(config.engineFlags) && config.engineFlags) || [];

  const loggerDebug = getLoggerDebug(scenario, viewport);

  // set up engineOptions obj
  let engineOptions = {};
  if (typeof config.engineOptions === 'object') {
    engineOptions = config.engineOptions;
  } else {
    // Check for (legacy) chromeFlags setting if there is no engineOptions config. chromeFlags option is depricated.
    if (chromeFlags.length) {
      config._logger.warn('***The chromeFlags property is depricated -- please see documentation for recommended way of setting chromeFlags.***', loggerDebug);
      engineOptions.chromeFlags = chromeFlags;
    }
  }

  // create base chromyOptions with default & config engineOptions
  let chromyOptions = Object.assign({}, defaultOptions, engineOptions);

  // if chromeFlags has not been explicitly set, then set it. (this is the expected case)
  if (!chromyOptions.chromeFlags) {
    chromyOptions.chromeFlags = DEFAULT_CHROME_FLAGS;
  }

  // if --window-size= has not been explicity set, then set it. (this is the expected case)
  if (!/--window-size=/i.test(chromyOptions.chromeFlags.toString())) {
    chromyOptions.chromeFlags = chromyOptions.chromeFlags.concat('--window-size=' + VP_W + ',' + VP_H + '');
    // chromyOptions.chromeFlags = chromyOptions.chromeFlags.concat(`--window-size=${VP_W},${VP_H}`);
  }

  config._logger.log('Starting Chromy: ' + JSON.stringify(chromyOptions), loggerDebug);
  let chromy = new Chromy(chromyOptions).chain();

  /**
   * =================
   * CLI BEHAVIORS
   * =================
   */

  if (isReference) {
    config._logger.log('CREATING NEW REFERENCE FILES', loggerDebug);
  }

  // // verbose console errors
  // if (config.debug) {
  //   config._logger.log('Debug is enabled!', loggerDebug);
  //   casper.on('page.error', function (msg, trace) {
  //     this.echo('Remote Error >    ' + msg, 'error');
  //     this.echo('file:     ' + trace[0].file, 'WARNING');
  //     this.echo('line:     ' + trace[0].line, 'WARNING');
  //     this.echo('function: ' + trace[0]['function'], 'WARNING');
  //   });
  // }

  // // verbose resource monitoring
  // casper.on('resource.received', function (resource) {
  //   var status = resource.status;
  //   if (status >= 400) {
  //     casper.log('remote error > ' + resource.url + ' failed to load (' + status + ')', 'error');
  //   }
  // });

  /**
   *  =============
   *  TEST UTILS
   *  =============
   */

  // --- set up console output ---
  chromy.console(function (text, consoleObj) {
    if (config._logger[consoleObj.level]) {
      config._logger[consoleObj.level](PORT + ' ' + (consoleObj.level).toUpperCase() + ' > ' + text, loggerDebug);
    } else {
      config._logger.log(PORT + ' ' + (consoleObj.level).toUpperCase() + ' > ' + text, loggerDebug);
    }
  });

  chromy
    .evaluate(_ => {
      let v = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
      return v ? parseInt(v[2], 10) : 0;
    })
    .result(chromeVersion => {
      config._logger.info(`${PORT} Chrome v${chromeVersion} detected.`, loggerDebug);
      if (chromeVersion < MIN_CHROME_VERSION) {
        config._logger.warn(`${PORT} ***WARNING! CHROME VERSION ${MIN_CHROME_VERSION} OR GREATER IS REQUIRED. PLEASE UPDATE YOUR CHROME APP!***`, loggerDebug);
      }
    });

  /**
   *  =============
   *  IMPLEMENT TEST CONFIGS
   *  =============
   */

  // --- BEFORE SCRIPT ---
  /* ============
    onBeforeScript files should export a module like so:

    module.exports = function(renderer, scenario, vp) {
      // run custom renderer (casper or chromy) code
    };
  ============ */
  var onBeforeScript = scenario.onBeforeScript || config.onBeforeScript;
  if (onBeforeScript) {
    var beforeScriptPath = path.resolve(engineScriptsPath, onBeforeScript);
    if (fs.existsSync(beforeScriptPath)) {
      require(beforeScriptPath)(chromy, scenario, viewport, isReference, Chromy, config);
    } else {
      config._logger.warn(PORT + ' WARNING: script not found: ' + beforeScriptPath, loggerDebug);
    }
  }

  // // --- SIMPLE AUTH ---
  // if (casper.cli.options.user && casper.cli.options.password) {
  //   config._logger.log('Auth User via CLI: ' + casper.cli.options.user, loggerDebug);
  //   casper.setHttpAuth(casper.cli.options.user, casper.cli.options.password);
  // }

  //  --- OPEN URL ---
  var url = scenario.url;
  if (isReference && scenario.referenceUrl) {
    url = scenario.referenceUrl;
  }
  chromy.goto(url);

  injectBackstopTools(chromy);

  //  --- WAIT FOR READY EVENT ---
  var readyEvent = scenario.readyEvent || config.readyEvent;
  if (readyEvent) {
    chromy
      .evaluate(`window._readyEvent = '${readyEvent}'`)
      .wait(_ => {
        return window._backstopTools.hasLogged(window._readyEvent);
      })
      .evaluate(_ => console.info('readyEvent ok'));
  }

  // --- WAIT FOR SELECTOR ---
  chromy.wait(scenario.readySelector || 0);

  // --- DELAY ---
  chromy.wait(scenario.delay || 0);

  //  --- OPTION DEBUG TO CONSOLE ---
  if (config.debug) {
    chromy
      .evaluate(_ => document.head.outerHTML)
      .result(headStr => config._logger.debug(PORT + 'HEAD > \n' + headStr, loggerDebug))
      .evaluate(_ => document.body.outerHTML)
      .result(htmlStr => config._logger.debug(PORT + 'BODY > \n' + htmlStr, loggerDebug));
  }

  // --- REMOVE SELECTORS ---
  if (scenario.hasOwnProperty('removeSelectors')) {
    scenario.removeSelectors.forEach(function (selector) {
      chromy
        .evaluate(`window._backstopSelector = '${selector}'`)
        .evaluate(
          () => {
            Array.prototype.forEach.call(document.querySelectorAll(window._backstopSelector), function (s, j) {
              s.style.cssText = 'display: none !important;';
              s.classList.add('__86d');
            });
          }
        );
    });
  }

  //  --- ON READY SCRIPT ---
  /* ============
    onReadyScript files should export a module like so:

    module.exports = function(renderer, scenario, vp, isReference) {
      // run custom renderer (casper or chromy) code
    };
  ============ */
  var onReadyScript = scenario.onReadyScript || config.onReadyScript;
  if (onReadyScript) {
    var readyScriptPath = path.resolve(engineScriptsPath, onReadyScript);
    if (fs.existsSync(readyScriptPath)) {
      require(readyScriptPath)(chromy, scenario, viewport, isReference, Chromy, config);
    } else {
      config._logger.warn(PORT + ' WARNING: script not found: ' + readyScriptPath, loggerDebug);
    }
  }

  // reinstall tools in case onReadyScript has loaded a new URL.
  injectBackstopTools(chromy);

  // --- HIDE SELECTORS ---
  if (scenario.hasOwnProperty('hideSelectors')) {
    scenario.hideSelectors.forEach(function (selector) {
      chromy
        .evaluate(`window._backstopSelector = '${selector}'`)
        .evaluate(
          () => {
            Array.prototype.forEach.call(document.querySelectorAll(window._backstopSelector), function (s, j) {
              s.style.visibility = 'hidden';
            });
          }
        );
    });
  }
  // CREATE SCREEN SHOTS AND TEST COMPARE CONFIGURATION (CONFIG FILE WILL BE SAVED WHEN THIS PROCESS RETURNS)
  // this.echo('Capturing screenshots for ' + makeSafe(vp.name) + ' (' + (vp.width || vp.viewport.width) + 'x' + (vp.height || vp.viewport.height) + ')', 'info');

  // --- HANDLE NO-SELECTORS ---
  if (!scenario.hasOwnProperty('selectors') || !scenario.selectors.length) {
    scenario.selectors = [DOCUMENT_SELECTOR];
  }

  return new Promise((resolve, reject) => {
    chromy
      .evaluate(`window._selectorExpansion = '${scenario.selectorExpansion}'`)
      .evaluate(`window._backstopSelectors = '${scenario.selectors}'`)
      .evaluate(() => {
        if (window._selectorExpansion.toString() === 'true') {
          window._backstopSelectorsExp = window._backstopTools.expandSelectors(window._backstopSelectors);
        } else {
          window._backstopSelectorsExp = window._backstopSelectors;
        }
        if (!Array.isArray(window._backstopSelectorsExp)) {
          window._backstopSelectorsExp = window._backstopSelectorsExp.split(',');
        }
        window._backstopSelectorsExpMap = window._backstopSelectorsExp.reduce((acc, selector) => {
          acc[selector] = {
            exists: window._backstopTools.exists(selector),
            isVisible: window._backstopTools.isVisible(selector)
          };
          return acc;
        }, {});
        return {
          backstopSelectorsExp: window._backstopSelectorsExp,
          backstopSelectorsExpMap: window._backstopSelectorsExpMap
        };
      })
      .result(_result => {
        resolve(delegateSelectors(
          chromy,
          scenario,
          viewport,
          variantOrScenarioLabelSafe,
          scenarioLabelSafe,
          config,
          _result.backstopSelectorsExp,
          _result.backstopSelectorsExpMap
        ));
      })
      .end()
      // If an error occurred then resolve with an error.
      .catch(e => resolve(new BackstopException('Chromy error', scenario, viewport, e)));
  });
}

// vvv HELPERS vvv
/**
 * [delegateSelectors description]
 * @param  {[type]} chromy                     [description]
 * @param  {[type]} scenario                   [description]
 * @param  {[type]} viewport                   [description]
 * @param  {[type]} variantOrScenarioLabelSafe [description]
 * @param  {[type]} config                     [description]
 * @return {[type]}                            [description]
 */
function delegateSelectors (chromy, scenario, viewport, variantOrScenarioLabelSafe, scenarioLabelSafe, config, selectors, selectorMap) {
  const fileNameTemplate = config.fileNameTemplate || DEFAULT_FILENAME_TEMPLATE;
  const configId = config.id || engineTools.genHash(config.backstopConfigFileName);
  const bitmapsReferencePath = config.paths.bitmaps_reference || DEFAULT_BITMAPS_REFERENCE_DIR;
  const outputFileFormatSuffix = '.' + ((config.outputFormat && config.outputFormat.match(/jpg|jpeg/)) || 'png');

  let compareConfig = { testPairs: [] };
  let captureDocument = false;
  let captureViewport = false;
  let captureList = [];
  let captureJobs = [];

  selectors.forEach(function (selector, i) {
    var cleanedSelectorName = selector.replace(/[^a-z0-9_-]/gi, ''); // remove anything that's not a letter or a number
    var fileName = engineTools.getFilename(fileNameTemplate, outputFileFormatSuffix, configId, scenario.sIndex, variantOrScenarioLabelSafe, i, cleanedSelectorName, viewport.vIndex, viewport.label);
    var referenceFilePath = bitmapsReferencePath + '/' + engineTools.getFilename(fileNameTemplate, outputFileFormatSuffix, configId, scenario.sIndex, scenarioLabelSafe, i, cleanedSelectorName, viewport.vIndex, viewport.label);
    var expect = engineTools.getScenarioExpect(scenario);
    var viewportLabel = viewport.label;
    var testFilePath = engineTools.testFilePath;
    var filePath = config.isReference ? referenceFilePath : testFilePath;

    if (!config.isReference) {
      var requireSameDimensions;
      if (scenario.requireSameDimensions !== undefined) {
        requireSameDimensions = scenario.requireSameDimensions;
      } else if (config.requireSameDimensions !== undefined) {
        requireSameDimensions = config.requireSameDimensions;
      } else {
        requireSameDimensions = config.defaultRequireSameDimensions;
      }
      compareConfig.testPairs.push({
        reference: referenceFilePath,
        test: testFilePath,
        selector: selector,
        fileName: fileName,
        label: scenario.label,
        requireSameDimensions: requireSameDimensions,
        misMatchThreshold: engineTools.getMisMatchThreshHold(scenario, config),
        url: scenario.url,
        referenceUrl: scenario.referenceUrl,
        expect: expect,
        viewportLabel: viewportLabel
      });
    }

    selectorMap[selector].filePath = filePath;
    if (selector === BODY_SELECTOR || selector === DOCUMENT_SELECTOR) {
      captureDocument = selector;
    } else if (selector === VIEWPORT_SELECTOR) {
      captureViewport = selector;
    } else {
      captureList.push(selector);
    }
  });

  const loggerDebug = getLoggerDebug(scenario, viewport);

  if (captureDocument) {
    captureJobs.push(function () { return captureScreenshot(chromy, null, captureDocument, selectorMap, config, [], loggerDebug); });
  }
  // TODO: push captureViewport into captureList (instead of calling captureScreenshot()) to improve perf.
  if (captureViewport) {
    captureJobs.push(function () { return captureScreenshot(chromy, null, captureViewport, selectorMap, config, [], loggerDebug); });
  }
  if (captureList.length) {
    captureJobs.push(function () { return captureScreenshot(chromy, null, null, selectorMap, config, captureList, loggerDebug); });
  }

  return new Promise(function (resolve, reject) {
    var job = null;
    var errors = [];
    var next = function () {
      if (captureJobs.length === 0) {
        if (errors.length === 0) {
          resolve();
        } else {
          reject(errors);
        }
        return;
      }
      job = captureJobs.shift();
      job.apply().catch(function (e) {
        errors.push(e);
      }).then(function () {
        next();
      });
    };
    next();
  }).then(function () {
    return chromy.close().end();
  }).catch(function (err) {
    return chromy.close().end().then(function () {
      throw err;
    });
  }).then(_ => compareConfig);
}

// TODO: remove filepath_
function captureScreenshot (chromy, filePath_, selector, selectorMap, config, selectors, loggerDebug) {
  return new Promise(function (resolve, reject) {
    // VIEWPORT screenshot
    if (selector === VIEWPORT_SELECTOR || selector === BODY_SELECTOR) {
      chromy
        .screenshot()
        .result(buffer => {
          return saveViewport(buffer, selector);
        });
    // DOCUMENT screenshot
    } else if (selector === NOCLIP_SELECTOR || selector === DOCUMENT_SELECTOR) {
      chromy.screenshotMultipleSelectors(['body'], saveSelector);
    // OTHER-SELECTOR screenshot
    } else {
      chromy.screenshotMultipleSelectors(selectors, saveSelector);
    }

    chromy
      .end()
      .then(_ => {
        resolve();
      })
      .catch(e => {
        reject(e);
      });

    // result helpers

    // saveViewport: selectors will be `body` or `viewport` ONLY
    function saveViewport (buffer, selector) {
      const filePath = selectorMap[selector].filePath;

      ensureDirectoryPath(filePath);
      return fs.writeFile(filePath, buffer);
    }

    // saveSelector: selectorArr will contain any valid selector (not body or viewport).
    // If body *is* found in selector arr then it was originally DOCUMENT_SELECTOR -- and it will be reset back to DOCUMENT_SELECTOR -- this is because chromy takes a Document shot when BODY is used.
    function saveSelector (err, buffer, index, selectorArr) {
      let selector = selectorArr[index];
      if (selector === BODY_SELECTOR) {
        selector = DOCUMENT_SELECTOR;
      }
      const selectorProps = selectorMap[selector];
      const filePath = selectorProps.filePath;
      if (!selectorProps.exists) {
        return fs.copy(config.env.backstop + SELECTOR_NOT_FOUND_PATH, filePath);
      } else if (!selectorProps.isVisible) {
        return fs.copy(config.env.backstop + HIDDEN_SELECTOR_PATH, filePath);
      } else {
        if (err) {
          config._logger.error('ChromyJS returned an unexpected error while attempting to capture a selector.' + err, loggerDebug);
          return new Error(err);
        }
        ensureDirectoryPath(filePath);
        return fs.writeFile(filePath, buffer);
      }
    }
  });
}

// TODO: ESCAPE ALL SELECTOR VALUES
// function escapeSingleQuote (string) {
//   if (typeof string !== 'string') {
//     return string
//   }
//   return string.replace(/'/g, '\\\'')
// }
