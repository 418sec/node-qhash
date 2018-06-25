qtimeit = require('qtimeit');
qhash = require('./');
util = require('util');

qtimeit.bench.timeGoal = 0.40;
qtimeit.bench.visualize = true;

var x;
var hash = {a: {b: {c: 0}}};
var hash2 = {a: {b: 0}};
var hash5 = {a: {b: {c: {d: {e: 0}}}}};
var arr4 = [ {a:{b:1}}, {a:{b:2}}, {a:{b:3}}, {a:{b:4}} ];
var hash2L = {firstFieldWithVeryLongName: {secondFieldWithVeryLongName: 1}};
var hash2M = {firstFieldName: {secondFieldName: 1}};
var hash1M = {firstFieldName: 1};
var hash2S = {firstName: {secondName: 1}};
var h0 = {}, h1 = {a:1}, h5 = {a:{b:{c:{d:{e:123}}}}}
var hfoo = {foo:1}
if (1) qtimeit.bench({
    'merge {}, {a:1}': function(){
        x = qhash.merge({}, h1);
    },
    'merge {}, {foo:1}': function(){
        x = qhash.merge({}, hfoo);
    },
    'merge {}, {a:{b:{c:{d:{e:123}}}}}': function(){
        x = qhash.merge({}, h5);
    },
    'selectField a': function(){
        x = qhash.selectField(arr4, 'a');
    },
    'selectField a.b': function(){
        x = qhash.selectField(arr4, 'a.b');
    },
})
console.log("")
if (1) qtimeit.bench({
    'set x': function(){
        qhash.set(hash, 'x', 1);
    },

    'set a.b': function(){
        qhash.set(hash2, 'a.b', 123);
    },

    'set long1.long2': function(){
        qhash.set(hash2L, 'firstFieldWithVeryLongName.secondFieldWithVeryLongName', 123);
    },

    'set med1.med2': function(){
        qhash.set(hash2M, 'firstFieldName.secondFieldName', 123);
    },

    'set sht1.sht2': function(){
        qhash.set(hash2S, 'firstName.secondName', 123);
    },

    'set med1': function(){
        qhash.set(hash1M, 'firstFieldName', 123);
    },

    'set a.b.c': function(){
        qhash.set(hash, 'a.b.c', 123);
    },

    'set a.b.c.d.e': function(){
        qhash.set(hash5, 'a.b.c.d.e', 123);
    },

    'get x': function(){
        x = qhash.get(hash, 'x');
    },

    'get a.b': function(){
        x = qhash.get(hash, 'a.b');
    },

    'get long1.long2': function(){
        x = qhash.get(hash2L, 'firstFieldWithVeryLongName.secondFieldWithVeryLongName');
    },

    'get med1.med2': function(){
        x = qhash.get(hash2M, 'firstFieldName.secondFieldName');
    },

    'get sht1.sht2': function(){
        x = qhash.get(hash2S, 'firstName.secondName');
    },

    'get med1': function(){
        x = qhash.get(hash1M, 'firstFieldName');
    },

    'get a.b.c': function(){
        x = qhash.get(hash, 'a.b.c');
    },

    'get a.b.c.d.e': function(){
        x = qhash.get(hash5, 'a.b.c.d.e');
    },

    'merge {}, {a:1}': function(){
        x = qhash.merge({}, h1);
    },

    'util._extend {}, {a:1}': function(){
        x = util._extend({}, h1);
    },
    'Object.assign {}, {a:1}': function(){
        x = Object.assign({}, h1);
    },
})
