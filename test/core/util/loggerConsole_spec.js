const assert = require('assert');
const chalk = require('chalk');
const logger = require('../../../core/util/logging/loggerConsole');

describe('logger console', function () {

  function test(fn) {
    let log = '';
    const clog = console.log;
    console.log = function(s) { log += s; };

    try {
      fn();
    } finally {
      console.log = clog;
      return log;
    }
  }

  it('should behave as console.log when no subject is provided', function () {
    const fn = () => logger().log('test');
    const log = test(fn);
    assert.strictEqual(log, chalk.white('test'));
  });

  it('should behave as console.log when `null` subject is provided', function () {
    const fn = () => logger(null).log('test');
    const log = test(fn);
    assert.strictEqual(log, chalk.white('test'));
  });

  it('should behave as console.log when empty string subject is provided', function () {
    const fn = () => logger('').log('test');
    const log = test(fn);
    assert.strictEqual(log, chalk.white('test'));
  });

  it('should assume minimum padding of 5 with short subject and single line string', function () {
    const fn = () => logger('s').log('test');
    const log = test(fn);
    assert.strictEqual(log, chalk.white('    s ') + '| test');
  });

  it('should assume minimum padding of 5 with short subject and multiline string', function () {
    const fn = () => logger('s').log('test\nsecond line');
    const log = test(fn);
    assert.strictEqual(log, chalk.white('    s ') + '| test\n        second line');
  });

  it('should expand padding with long subject and single line string', function () {
    const fn1 = () => logger('a longer subject').log('test');
    const log1 = test(fn1);
    assert.strictEqual(log1, chalk.white('a longer subject ') + '| test');

    const fn2 = () => logger('s').log('second');
    const log2 = test(fn2);
    assert.strictEqual(log2, chalk.white('               s ') + '| second');
  });

  it('should expand padding with long subject and multiline string', function () {
    const fn1 = () => logger('a longer subject').log('first\nsecond');
    const log1 = test(fn1);
    assert.strictEqual(log1, chalk.white('a longer subject ') + '| first\n                   second');

    const fn2 = () => logger('s').log('third\nfourth');
    const log2 = test(fn2);
    assert.strictEqual(log2, chalk.white('               s ') + '| third\n                   fourth');
  });

  it('should display text of Error', function () {
    const fn = () => logger().log(new Error('msg'));
    const log = test(fn);
    assert.strictEqual(log, chalk.white('Error: msg'));
  });

});
