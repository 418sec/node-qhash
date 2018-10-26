/**
 * Copyright (C) 2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

'use strict';

var util = require('util');
var qdiff = require('./qdiff');

var Pipe = process.binding('pipe_wrap').Pipe;
var TTY = process.binding('tty_wrap').TTY;

if (parseInt(process.version.slice(1)) < 6) {
    // node-v4, v5 cannot assign read-only property 'from'
    Object.defineProperty(Buffer, 'from', { writable: true, value: function(a, b, c) { return new Buffer(a, b, c) } })
}

module.exports = {
    'package': {
        'should export expected methods': function(t) {
            t.equal(typeof qdiff.backup, 'function');
            t.equal(typeof qdiff.compare, 'function');
            t.done();
        },
    },

    'backup': {
        'should back up simple values': function(t) {
            t.ok(qdiff.backup(1));
            t.done();
        },

        'should back up objects': function(t) {
            var dataset = {
                // object types
                emptyObject: {}, object: {a:1},
                number: new Number(123), string: new String("abc"), bool: new Boolean(true), regex: /abc/, date: new Date(),
                emptyArray: new Array(), array: new Array(1,2,3),
                emptyBuffer: Buffer.from(""), buffer: Buffer.from("a"),
                ui8Array: new Uint8Array(1,2,3), ui16Array: new Uint16Array(1,2,3), ui32Array: new Uint32Array(1,2,3),
                ui8cArray: new Uint8ClampedArray(1,2,3),
                i8Array: new Int8Array(1,2,3), i16Array: new Int16Array(1,2,3), i32Array: new Int32Array(1,2,3),
                f32Array: new Float32Array(1,2,3), f64Array: new Float64Array(1,2,3),
                // FIXME: also test contents
                emptyMap: global.Map && new Map(), emptyWeakMap: global.WeakMap && new WeakMap(),
                emptySet: global.Set && new Set(), emptyWeakSet: global.WeakSet && new WeakSet(),
                promise: global.Promise && Promise.resolve(1), proxy: global.Proxy && new Proxy({}, {}), reflect: global.Reflect && Reflect,

                // function types
                func: function(){},

                // oddball items
                otherConstructor: { constructor: global.Map && new Map() || new Array() },
            };
            var bak = qdiff.backup(Object.keys(dataset).map(function(name){ return dataset[name] }));
            t.ok(bak);
            for (var i=0; i<dataset.length; i++) t.equal(typeof bak.props[i], 'object');
            t.done();
        },

        'should back up symbols': function(t) {
            if (!global.Symbol) t.skip();

            if (typeof Symbol !== 'function') return t.done();
            var sym = Symbol('a'), obj = {};
            obj[sym] = 1;
            var bak = qdiff.backup(obj);
            // TODO: back up as simple value
            t.equal(bak.props[sym].value, 1);
            t.done();
        },

        'should back up prototype': function(t) {
            t.skip();
        },

        'should back up getter / setter': function(t) {
            t.skip();
        },

        'should back up Buffers': function(t) {
            var bak = qdiff.backup(Buffer.from("foo"));
            t.ok(bak.props.length == 3 || bak.props.length.value == 3);
            t.ok(bak.props.constructor);
            // TODO: do not wrap simple value array/buffer contents
            t.ok(bak.props[0] == 'f'.charCodeAt(0) || bak.props[0].value == 'f'.charCodeAt(0));
            t.ok(bak.props.__proto__);
            t.done();
        },

        'should back up object state': function(t) {
            var bak, obj = {};
            t.equal(bak = qdiff.backup(obj).oflags, '--X');
            // note: both freeze and seal change the object state to SF-
            Object.freeze(obj);
            t.equal(bak = qdiff.backup(obj).oflags, 'SF-');
            obj = {};
            Object.seal(obj);
            t.equal(bak = qdiff.backup(obj).oflags, 'SF-');
            t.done();
        },

        'should back up property state': function(t) {
            for (var writable=0; writable<=1; writable++) {
                for (var enumerable=0; enumerable<=1; enumerable++) {
                    for (var configurable=0; configurable<=1; configurable++) {
                        var obj = {};
                        Object.defineProperty(obj, 'a', { value: 1, writable: writable, enumerable: enumerable, configurable: configurable });
                        var bak = qdiff.backup(obj);
                        // note: if property is not configurable, cannot be deleted or redefined
                        // note: simple properties are backed up as simple values if possible (not as object)
                        if (writable && enumerable && configurable) t.equal(bak.props.a, 1);
                        else t.equal(bak.props.a.pflags, (enumerable ? 'K' : 'P') + (writable ? 'W' : '-') + (enumerable ? 'E' : '-') + (configurable ? 'C' : '-'));
                    }
                }
            }
            t.done();
        },

        'edge cases': {
            'should work without Map': function(t) {
                var Map = global.Map;
                global.Map = undefined;
                t.unrequire('qdiff');
                var qdiff2 = require('./qdiff');
                var bak = qdiff2.backup({a:1});
                t.ok(bak);
                t.equal(bak.props.a, 1);
                global.Map = Map;
                t.done();
            },

            'should back up read-only properties': function(t) {
                var bak = qdiff.backup(Buffer.from("foo"));
                t.ok(bak.props.length == 3 || bak.props.length.value == 3);
                t.done();
            },

            'should back up inaccessible properties': function(t) {
                var pipe = new Pipe(0);
                var bak = qdiff.backup(pipe);
                // node-v0.10 does not have a bytesRead property, nor does node-v10
                // node-v8 works, node-v9 breaks on null.value
                var prototype = bak.props.constructor.props.prototype.value.props;
                switch (parseInt(process.version.slice(1)) == 8) {
                case 9: t.strictEqual(prototype.bytesRead.value, '<cannot get descriptor>'); break;
                case 8: t.strictEqual(prototype.bytesRead.value, null); break;
                }
                t.done();
            },

            'should backup even if no Object.getOwnPropertySymbols': function(t) {
                if (!global.Symbol) t.skip();

                var getSyms = Object.getOwnPropertySymbols;
                delete Object.getOwnPropertySymbols;
                var sym = Symbol("foo")
                var obj = { a: 1 }; obj[sym] = 2;
                var bak = qdiff.backup(obj);
                Object.getOwnPropertySymbols = getSyms;
                t.equal(bak.props.a, 1);
                t.ok(!bak.props[sym]);
                t.done();
            },

            'should backup even if no Buffer.allocUnsafe': function(t) {
                // node-v6 calls allocUnsafe from its constructor, cannot test
                if (parseInt(process.version.slice(1)) === 6) return t.skip();

                var allocUnsafe = Buffer.allocUnsafe;
                delete Buffer.allocUnsafe;
                var bak = qdiff.backup(Buffer.from("abc"));
                Buffer.allocUnsafe = allocUnsafe;
                t.equal(bak.value.toString(), "abc");
                t.done();
            },

            'should tolerate a getter that throws': function(t) {
                var getter = function(){ throw 'getter error' };
                t.expect(4);

                var obj = { a: 1 };
                Object.defineProperty(obj, 'x', { get: getter });
                var bak = qdiff.backup(obj);
                t.ok(true);     // backed up ok

                var obj2 = { a: 1, x: 2 };
                t.ok(!qdiff.compare(bak, qdiff.backup(obj2)));

                var obj3 = { a: 1 };
                t.ok(!qdiff.compare(bak, qdiff.backup(obj3)));

                var obj4 = { a: 1 };
                Object.defineProperty(obj4, 'x', { get: getter });
                t.ok(qdiff.compare(bak, qdiff.backup(obj4)));

                t.done();
            },

            'should back up global': function(t) {
                var bak1 = qdiff.backup(global);
                var bak2 = qdiff.backup(global);
                t.ok(qdiff.compare(bak1, bak2));
                t.done();
            },
        },
    },

    'compare': {
        setUp: function(done) {
            this.obj = { a: 1, b: { ba: 21 } };
            this.bak = qdiff.backup(this.obj);
            this.bak2 = qdiff.backup({ a: 1, b: 2 });
            done();
        },

        'should compare two identical objects': function(t) {
            t.ok(qdiff.compare(this.bak, qdiff.backup(this.obj)));

            var bak1 = qdiff.backup(util);
            var bak2 = qdiff.backup(util);
            t.ok(qdiff.compare(bak1, bak2));

            t.done();
        },

        'should detect added properties': function(t) {
            Object.defineProperty(this.obj.b, 't', { value: 1, enumerable: true });
            t.ok(!qdiff.compare(this.bak, qdiff.backup(this.obj)));
            t.done();
        },

        'should detect deleted/added properties': function(t) {
            t.ok(qdiff.compare(this.bak, qdiff.backup(this.obj)));

            delete this.obj.b;
            t.ok(!qdiff.compare(this.bak, qdiff.backup(this.obj)));

            // even if a new property is added
            this.obj.c = { ca: 31 };
            t.ok(!qdiff.compare(this.bak, qdiff.backup(this.obj)));
            delete this.obj.c;

            // even if replaced with a different value
            this.obj.b = 3;
            t.ok(!qdiff.compare(this.bak, qdiff.backup(this.obj)));

            // but match if restored to original value
            this.obj.b = { ba: 21 };
            t.ok(qdiff.compare(this.bak, qdiff.backup(this.obj)));

            t.done();
        },

        'should detect deleted/added symbols': function(t) {
            if (!global.Symbol) t.skip();

            // symbol added
            var obj = { a: 1, b: 2 }, sym1 = Symbol('foo'), sym2 = Symbol('bar');
            obj[sym1] = 3;
            var bak = qdiff.backup(obj);
            t.ok(!qdiff.compare(bak, qdiff.backup((obj[sym2] = 4, obj))));
            delete obj[sym2];

            // symbol deleted
            delete obj[sym1];
            t.ok(!qdiff.compare(bak, qdiff.backup(obj)));

            t.done();
        },

        'should detect changes to the prototype': function(t) {
            function F(a) { this.a = a };
            F.prototype.x = 99;
            var bak = qdiff.backup(new F(1));
            F.prototype.y = 100;
            t.ok(!qdiff.compare(bak, qdiff.backup(new F(1))));

            delete F.prototype.y;
            delete F.prototype.x;
            t.ok(!qdiff.compare(bak, qdiff.backup(new F(1))));

            t.done();
        },

        'should detect altered W properties': function(t) {
            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.defineProperty(obj, 'a', { writable: false })))));

            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.defineProperty(obj, 'a', { enumerable: false })))));

            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.defineProperty(obj, 'a', { configurable: false })))));

            t.done();
        },

        'should detect change in KEC properties': function(t) {
            Object.defineProperty(this.obj, 'a', { enumerable: false, configurable: true });
            var bak1 = qdiff.backup(this.obj);
            Object.defineProperty(this.obj, 'a', { configurable: false });
            t.ok(!qdiff.compare(bak1, qdiff.backup(this.obj)));
            t.done();
        },

        'should detect altered object state': function(t) {
            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.seal(obj), obj))));

            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.freeze(obj), obj))));

            var obj = { a: 1 };
            t.ok(!qdiff.compare(qdiff.backup(obj), qdiff.backup((Object.preventExtensions(obj), obj))));

            t.done();
        },

        'should detect altered inner objects': function(t) {
            this.obj.b.ba = 3;
            t.ok(!qdiff.compare(this.bak, qdiff.backup(this.obj)));
            t.done();
        },

        'should ignore differences in options.skip properties': function(t) {
            var bak1 = qdiff.backup({ a: 1, b: 2, c: 3 });
            var bak2 = qdiff.backup({ a: 1, b: 2, c: 4 });
            t.ok(qdiff.compare(bak1, bak2, { skip: { 'x.c': 1 } }));
            t.done();
        },

        'should compare primitive types': function(t) {
            t.ok(qdiff.compare(qdiff.backup({ a: new Number(1) }), qdiff.backup({ a: new Number(1) })));
            t.ok(qdiff.compare(qdiff.backup({ a: new Number(NaN) }), qdiff.backup({ a: new Number(NaN) })));
            t.ok(!qdiff.compare(qdiff.backup({ a: new Number(1) }), qdiff.backup({ a: new Number(2) })));

            t.ok(qdiff.compare(qdiff.backup({ a: new String('a') }), qdiff.backup({ a: new String('a') })));
            t.ok(!qdiff.compare(qdiff.backup({ a: new String('a') }), qdiff.backup({ a: new String('b') })));

            t.ok(qdiff.compare(qdiff.backup({ a: new Boolean(1) }), qdiff.backup({ a: new Boolean(1) })));
            t.ok(qdiff.compare(qdiff.backup({ a: new Boolean(0) }), qdiff.backup({ a: new Boolean(0) })));
            t.ok(qdiff.compare(qdiff.backup({ a: new Boolean(0) }), qdiff.backup({ a: new Boolean(1) })));

            t.ok(qdiff.compare(qdiff.backup({ a: /foo/i }), qdiff.backup({ a: /foo/i })));
            t.ok(!qdiff.compare(qdiff.backup({ a: /foo/ }), qdiff.backup({ a: /foo/i })));
            t.ok(!qdiff.compare(qdiff.backup({ a: /foo/i }), qdiff.backup({ a: /Foo/i })));

            t.ok(qdiff.compare(qdiff.backup({ a: new Date(1) }), qdiff.backup({ a: new Date(1) })));
            t.ok(!qdiff.compare(qdiff.backup({ a: new Date(1) }), qdiff.backup({ a: new Date(2) })));

            t.ok(!qdiff.compare(qdiff.backup({ a: new Number(1) }), qdiff.backup({ a: new String('1') })));

            if (global.Symbol) {
                var sym1 = Symbol("foo");
                var sym2 = Symbol("foo");
                var obj1a = {}; obj1a[sym1] = 1;
                var obj1b = {}; obj1b[sym1] = 1;
                var obj2 = {}; obj2[sym2] = 1;
                t.ok(qdiff.compare(qdiff.backup({ a: sym1 }), qdiff.backup({ a: sym1 })));
                t.ok(!qdiff.compare(qdiff.backup({ a: sym1 }), qdiff.backup({ a: sym2 })));
                t.ok(qdiff.compare(qdiff.backup(obj1a), qdiff.backup(obj1b)));
                t.ok(!qdiff.compare(qdiff.backup(obj1a), qdiff.backup(obj2)));
            }

            t.done();
        },

        'edge cases': {
            'should work without Map': function(t) {
                var bak2 = qdiff.backup(this.obj);
                var Map = global.Map;
                global.Map = undefined;
                t.unrequire('qdiff');
                var qdiff2 = require('./qdiff');
                var ok = qdiff2.compare(this.bak, bak2);
                t.ok(ok);
                global.Map = Map;
                t.done();
            },
        },
    },
}

function TestClass ( obj ) {
    for (var k in obj) this[k] = obj[k];
}
TestClass.prototype = {};
