var path = require('path');
var map = require('p-map');
var fs = require('fs');
var cp = require('child_process');

var Reporter = require('./../Reporter');
var storeFailedDiffStub = require('./store-failed-diff-stub.js');

var ASYNC_COMPARE_LIMIT = 20;

function comparePair (pair, report, config, logger, compareConfig) {
  var Test = report.addTest(pair);

  var referencePath = pair.reference ? path.resolve(config.projectPath, pair.reference) : '';
  var testPath = pair.test ? path.resolve(config.projectPath, pair.test) : '';

  var loggerDebug = {
    scenario: { label: pair.label },
    viewport: { label: pair.viewportLabel },
    stage: 'compare'
  };

  // TEST RUN ERROR/EXCEPTION
  if (!referencePath || !testPath) {
    var MSG = `${pair.msg}: ${pair.error}. See scenario – ${pair.scenario.label} (${pair.viewport.label})`;
    Test.status = 'fail';
    logger.error(MSG, loggerDebug);
    pair.error = MSG;
    return Promise.resolve(pair);
  }

  // REFERENCE NOT FOUND ERROR
  if (!fs.existsSync(referencePath)) {
    // save a failed image stub
    storeFailedDiffStub(testPath);

    Test.status = 'fail';
    logger.error('Reference image not found ' + pair.fileName, loggerDebug);
    pair.error = 'Reference file not found ' + referencePath;
    return Promise.resolve(pair);
  }

  if (!fs.existsSync(testPath)) {
    Test.status = 'fail';
    logger.error('Test image not found ' + pair.fileName, loggerDebug);
    pair.error = 'Test file not found ' + testPath;
    return Promise.resolve(pair);
  }

  if (pair.expect) {
    const scenarioCount = compareConfig.testPairs.filter(p => p.label === pair.label && p.viewportLabel === pair.viewportLabel).length;
    if (scenarioCount !== pair.expect) {
      Test.status = 'fail';
      const error = `Expect ${pair.expect} images for scenario "${pair.label} (${pair.viewportLabel})", but actually ${scenarioCount} images be found.`;
      logger.error(error, loggerDebug);
      pair.error = error;
      return Promise.resolve(pair);
    }
  }

  var resembleOutputSettings = config.resembleOutputOptions;
  return compareImages(referencePath, testPath, pair, resembleOutputSettings, Test, logger, loggerDebug);
}

function compareImages (referencePath, testPath, pair, resembleOutputSettings, Test, logger, loggerDebug) {
  return new Promise(function (resolve, reject) {
    var worker = cp.fork(require.resolve('./compare'));
    worker.send({
      referencePath: referencePath,
      testPath: testPath,
      resembleOutputSettings: resembleOutputSettings,
      pair: pair
    });

    worker.on('message', function (data) {
      worker.kill();
      Test.status = data.status;
      pair.diff = data.diff;

      var res;
      if (data.status === 'fail') {
        pair.diffImage = data.diffImage;
        var message = 'ERROR { requireSameDimensions: ' + (data.requireSameDimensions ? 'true' : 'false') + ', size: ' + (data.isSameDimensions ? 'ok' : 'isDifferent') + ', content: ' + data.diff.misMatchPercentage + '%, threshold: ' + pair.misMatchThreshold + '% }: ' + pair.label + ' ' + pair.fileName;
        res = Object.assign({}, loggerDebug, { result: false });
        logger.error(message, res);
      } else {
        res = Object.assign({}, loggerDebug, { result: true });
        logger.success('OK: ' + pair.label + ' ' + pair.fileName, res);
      }

      resolve(data);
    });
  });
}

module.exports = function (config) {
  var logger = require('./../logging/logger')(config, 'compare');
  var compareConfig = require(config.tempCompareConfigFileName).compareConfig;

  var report = new Reporter(config.ciReport.testSuiteName);
  var asyncCompareLimit = config.asyncCompareLimit || ASYNC_COMPARE_LIMIT;
  report.id = config.id;

  return map(compareConfig.testPairs, pair => comparePair(pair, report, config, logger, compareConfig), { concurrency: asyncCompareLimit })
    .then(
      () => report,
      e => logger.error('The comparison failed with error: ' + e)
    );
};
