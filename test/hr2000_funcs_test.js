'use strict';

var HR2000 = require('../lib/hr2000.js').HR2000;

var options = {
    VID: 0x2457,
    PID: 0x101E,
    integrationTime: 1000,
    strobleEnableStatus: 0,
    shutdownMode: 0,
    triggerMode: 0
};
var hr = new HR2000(options);

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
**/

exports['hr2000'] = {
    setup: function(test) {
        test.equal(options.VID, hr.options.VID, "Options not worked");
        test.done();
    },
    test_options: function(test) {
        test.equal(options.VID, hr.options.VID, "VID setup not worked");
        test.equal(options.PID, hr.options.PID, "PID setup not worked");
        test.equal(options.integrationTime, hr.options.integrationTime, "integrationTime setup not worked");
        test.equal(options.strobleEnableStatus, hr.options.strobleEnableStatus, "strobleEnableStatus setup not worked");
        test.equal(options.triggerMode, hr.options.triggerMode, "triggerMode setup not worked");
        test.done();
    },
    start_with_claim: function(test) {
        test.equal(hr._internal.claimed, true, "Did not started claimed");
        test.done();
    },
    test_claim: function(test) {
        hr.claim();
        test.equal(hr._internal.claimed, true, "Claim did not work");
        // hr.release();
        // test.equal(hr._internal.claimed, false, "Release did not work");
        test.done();
    },
    test_generate_generic_funcs: function(test) {
        var funcs = hr.funcs.getFuncs();
        for(var i = 0; i < funcs.length; i++) {
            var func = funcs[i];
            test.equal(typeof(HR2000.prototype[func.name]), 'function', 'Function ' + func.name + ' was not generated');
        }
        test.done();
    },

    test_func_getByName: function(test) {
        var func = hr.funcs.getByName('intialize');
        test.equal(func.name, 'intialize', 'Function getByName not worked');
        func = hr.funcs.getByName('blablabla');
        test.equal(func, null, 'Function not generated not suppose to show');
        test.done();
    },
    test_func_getByData: function(test) {
        var func = hr.funcs.getByType(0x01);
        test.equal(func.name, 'intialize', 'Function getByName not worked');
        func = hr.funcs.getByName(0);
        test.equal(func, null, 'Function not generated not suppose to show');
        test.done();
    }

};