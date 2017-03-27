/**
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var assert = require('qassert');
var qhash = require('./');

describe ('qhash', function() {
    describe ('merge', function() {
        function testMergeDataset( dataset ) {
            for (var i=0; i<dataset.length; i++) {
                var target = dataset[i][0];
                var source = dataset[i][1];
                var expect = dataset[i][2];

                qhash.merge(target, source);
                assert.deepEqual(target, expect);
            }
        }

        it ('should merge hashes', function(done) {
            var dataset = [
                [ {}, {a:1}, {a:1} ],
                [ {a:{}}, {a:1}, {a:1} ],
                [ {a:1}, {a:{b:2}}, {a:{b:2}} ],
                [ {a:{b:1}}, {a:{c:2}}, {a:{b:1, c:2}} ],
                [ {}, {a:[1,2,3]}, {a:[1,2,3]} ],
            ];
            testMergeDataset(dataset);
            done();
        })

        it ('should return the target', function(done) {
            var target = {};
            var x = qhash.merge(target, {a:1});
            assert.strictEqual(x, target);
            done();
        })

        it ('should not reuse any source sub-hash', function(done) {
            var subhash = {b: 1};
            var target = {};
            qhash.merge(target, {a: subhash});
            assert.deepEqual(target.a, subhash);
            assert.ok(target.a != subhash);
            done();
        })

        it ('should assign class-ed properties directly', function(done) {
            var dataset = [
                new Date(),
                function(){},
                new RegExp("x"),
                [1],
            ];
            for (var i=0; i<dataset.length; i++) {
                var object = dataset[i];
                object.x = 1;
                var target = qhash.merge({a:{}}, {a:object});
                assert.strictEqual(target.a.x, 1);
                assert.strictEqual(target.a, object);
            }
            done();
        })

        it ('should merge into `this` if no target specified', function(done) {
            var target = {a:1};
            target.merge = qhash.merge;
            // hide 'merge' from deepEqual
            Object.defineProperty(target, 'merge', { enumerable: false });
            target.merge({b:2});
            assert.deepEqual(target, {a:1, b:2});
            done();
        })

        it ('should merge nested property into sub-hash', function(done) {
            var dataset = [
                [ {a:{}}, {a:{b:{c:1}}}, {a:{b:{c:1}}} ],
                [ {a: {b:1}}, {a:{c:2}}, {a:{b:1, c:2}} ],
                [ {a: {b: {c: {d:1}}}}, {a:{b:{e:2}}}, {a:{b:{c:{d:1}, e:2}}} ],
            ];
            testMergeDataset(dataset);
            done();
        })

        describe ('options', function() {
            it ('noOverwrite should not alter existing properties', function(done) {
                var target = qhash.merge({a:1, b:2}, {b:3, c:4}, true);
                assert.deepEqual(target, {a:1, b:2, c:4});
                var target = qhash.merge({a:1, h:2}, {h:3}, true);
                assert.strictEqual(target.h, 2);
                var target = qhash.merge({a:1, h:2}, {h:{c:3}}, true);
                assert.strictEqual(target.h, 2);
                var target = qhash.merge({a:1, h:{b:2}}, {h:{c:3}}, true);
                assert.deepEqual(target.h, {b:2, c:3});
                done();
            })
        })
    })

    describe ('get', function() {
        function testGetDataset( dataset ) {
            for (var i=0; i<dataset.length; i++) {
                var target = dataset[i][0];
                var name = dataset[i][1];
                var expect = dataset[i][2];

                var value = qhash.get(target, name);
                assert.deepEqual(value, expect);
            }
        }

        it ('should return property or undefined if not set', function(done) {
            var dataset = [
                [ {}, 'a', undefined ],
                [ {b:1}, 'a', undefined ],
                [ {b:1}, 'b', 1 ],
                [ {b:1}, 'c', undefined ],
                [ {b:1}, 'b.c', undefined ],
                [ {}, 'b.c.d', undefined ],
                [ {a: {b: {c: 1}}}, 'a', {b:{c:1}} ],
                [ {a: {b: {c: 1}}}, 'a.b', {c:1} ],
                [ {a: {b: {c: 1}}}, 'a.c', undefined ],
                [ {a: {b: {c: 1}}}, 'a.b.c', 1 ],
                [ {a: {b: {c: 1}}}, 'a.b.d', undefined ],
                [ {a: {b: {c: 1}}}, 'a.b.c.d', undefined ],
                [ {a: [1,2,3]}, 'a.1', 2 ],
            ];
            testGetDataset(dataset);
            done();
        })

        it ('should get from `this` if no target specified', function(done) {
            var target = {a:{b:1}, c:2};
            target.get = qhash.get;
            assert.deepEqual(target.get('a'), {b:1});
            assert.strictEqual(target.get('b'), undefined);
            assert.strictEqual(target.get('c'), 2);
            assert.strictEqual(target.get('a.b'), 1);
            assert.strictEqual(target.get('b.a'), undefined);
            assert.strictEqual(target.get('a.c'), undefined);
            done();
        })
    })

    describe ('set', function() {
        function testSetDataset( dataset ) {
            for (var i=0; i<dataset.length; i++) {
                var target = dataset[i][0];
                var name = dataset[i][1];
                var value = dataset[i][2];
                var expect = dataset[i][3];

                qhash.set(target, name, value);
                assert.deepEqual(target, expect);
            }
        }

        it ('should set property', function(done) {
            var dataset = [
                [ {}, 'a', 1, {a:1} ],
                [ {}, 'b', [1], {b:[1]} ],
                [ {a:1}, 'b', 2, {a:1, b:2} ],
                [ {b:1}, 'a', 2, {b:1, a:2} ],
                [ {a:[]}, 'a.0', 1, {a:{'0':1}} ],
                [ {a:[]}, 'a.0', 1, {a:[1]} ],          // TODO: is object, not array!
            ];
            testSetDataset(dataset);
            done();
        })

        it ('should return the set value', function(done) {
            var value = Math.random();
            assert.strictEqual(qhash.set({}, 'a', value), value);
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
                [ {a:{b:{c:1}}}, 'a.b', 3, {a:{b:3}} ],
                [ {a:{b:1}}, 'a', 3, {a:3} ],
            ];
            testSetDataset(dataset);
            done();
        })

        it ('should set property to given object', function(done) {
            var x = {b:1};
            var target = {a:0};
            qhash.set(target, 'a', x);
            assert.strictEqual(target.a, x);
            done();
        })

        it ('should set on `this` if no target specified', function(done) {
            var target = {};
            target.set = qhash.set;
            target.set('a.b', 3);
            assert.deepEqual(target.a, {b:3});
            done();
        })
    })

    describe ('selectField', function() {
        it ('should return selected fields', function(done) {
            var dataset = [
                // unset field
                [ [], 'a', [] ],
                [ [ null ], 'a', [ undefined ] ],
                [ [ undefined ], 'a', [ undefined ] ],
                [ [ {b:1} ], 'a', [ undefined ] ],
                [ [ {b:1} ], 'b.a', [ undefined ] ],
                [ [ {b:1} ], 'a.b', [ undefined ] ],
                // by direct name
                [ [ {a:1} ], 'a', [ 1 ] ],
                [ [ {a:1}, {b:0, a:2} ], 'a', [ 1, 2 ] ],
                [ [ {a:1}, {b:0, a:2} ], 'a', [ 1, 2 ] ],
                [ [ {a:1}, {b:0}, {a:2} ], 'a', [ 1, undefined, 2 ] ],
                // by dotted name
                [ [ {a:{a:1}}, {a:{}}, {}, {a:{a:{}}}, {a:{a:{a:1}}} ], 'a.a', [ 1, undefined, undefined, {}, {a:1} ] ],
            ];
            for (var i=0; i<dataset.length; i++) {
                assert.deepEqual(qhash.selectField(dataset[i][0], dataset[i][1]), dataset[i][2]);
            }
            done();
        })
    })

    describe ('decorate', function() {
        it ('should return target', function(done) {
            var target = {};
            var x = qhash.decorate(target, {a: 1});
            assert.strictEqual(x, target);
            assert.strictEqual(x.a, 1);
            done();
        })

        it ('should attach methods', function(done) {
            var fn = function(){};
            var target = qhash.decorate({fn: 1, fn2: 2}, {fn: fn}, {});
            assert.strictEqual(target.fn, fn);
            assert.strictEqual(target.fn2, 2);
            done();
        })

        describe ('options', function() {
            it ('should not overwrite', function(done) {
                var fn = function(){};
                var target = qhash.decorate({fn: 1}, {fn: fn}, {noOverwrite: true});
                assert.strictEqual(target.fn, 1);
                done();
            })

            it ('should hide attached methods', function(done) {
                var fn = function(){};
                var target = qhash.decorate({}, {fn: fn}, {hide: true});
                assert.equal(target.fn, fn);
                assert.deepEqual(target, {});       // <-- odd one
                assert('fn' in target);             // <-- another odd one
                assert.ok(Object.keys(target).indexOf('fn') < 0);
                done();
            })
        })
    })
})
