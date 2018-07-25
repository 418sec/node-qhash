/**
 * Copyright (C) 2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict'

var backup = require('./clone').backup;
var restore = require('./clone').restore;
var clone = require('./clone').clone;

module.exports = {
    'backup': {
        'strings': function(t) {
            var o = { a: "foo", b: new String("foo") };
            var b = backup(o);
            var r = restore(b);
            t.deepEqual(r, o);
            t.strictEqual(r.a, o.a);
            t.notEqual(r.b, o.b);
            t.done();
        },
    },
}
