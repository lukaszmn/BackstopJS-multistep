const assert = require('assert');
const logger = require('../../../core/util/logging/logger');

describe('logger', function () {
  function test (fn) {
    let log = '';
    const clog = console.log;
    console.log = function (s) { log += s; };

    try {
      fn();
      return log;
    } catch (err) {
      return err;
    } finally {
      console.log = clog;
    }
  }

  it('should print to console when "console" logger is used', function () {
    const fn = () => logger({ logger: 'console' }).log('test');
    const log = test(fn);
    assert(log.indexOf('test') > -1);
  });

  it('should not print to console when "nil" logger is used', function () {
    const fn = () => logger({ logger: 'nil' }).log('test');
    const log = test(fn);
    assert.strictEqual(log, '');
  });
});
