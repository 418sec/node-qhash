'use strict';

var assert = require('qassert');
var qhash = require('./');

describe ('qhash', function() {
    describe ('_merge', function() {
        it ('should merge hashes', function(done) {
            done();
        })

        it ('should not reuse any source sub-hash', function(done) {
            done();
        })
    })

    describe ('_get', function() {
        it ('should return property', function(done) {
            done();
        })

        it ('should return undefined if no such property', function(done) {
            done();
        })
    })

    describe ('_set', function() {
        function testSetDataset( dataset ) {
            for (var i=0; i<dataset.length; i++) {
                var target = dataset[i][0];
                var name = dataset[i][1];
                var value = dataset[i][2];
                var expect = dataset[i][3];

                qhash._set(target, name, value);
                assert.deepEqual(target, expect);
            }
        }

        it ('should set property', function(done) {
            var dataset = [
                [ {}, 'a', 1, {a:1} ],
                [ {}, 'b', [1], {b:[1]} ],
                [ {a:1}, 'b', 2, {a:1, b:2} ],
                [ {b:1}, 'a', 2, {b:1, a:2} ],
            ];

            testSetDataset(dataset);

            done();
        })

        it ('should create missing hashes', function(done) {
            var dataset = [
                [ {}, 'a.b', 2, {a:{b:2}} ],
                [ {}, 'a.b', {c:3, d:[4]}, {a:{b:{c:3, d:[4]}}} ],
                [ {}, 'a.b.c', {d:1}, {a:{b:{c:{d:1}}}} ],
            ];

            testSetDataset(dataset);

            done();
        })

        it ('should overwrite existing property', function(done) {
            var dataset = [
                [ {a:1}, 'a', 2, {a:2} ],
                [ {a:1}, 'a', null, {a:null} ],
                [ {a:{b:1}}, 'a.b', 2, {a:{b:2}} ],
                [ {a:{b:1}}, 'a.b', {c:3}, {a:{b:{c:3}}} ],
                [ {a:{b:1}}, 'a', 3, {a:3} ],
            ];

            testSetDataset(dataset);

            done();
        })

        it ('should merge nested property into sub-hash', function(done) {
            // ...
            done();
        })

        it ('should set property to given object', function(done) {
            var x = {b:1};
            var target = {a:0};
            qhash._set(target, 'a', x);
            assert.strictEqual(target.a, x);
            done();
        })
    })
})
