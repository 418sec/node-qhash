/**
 * Copyright (C) 2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * 2018-06-25 - AR.
 */

'use strict';


var Pipe = process.binding('pipe_wrap').Pipe;
var TTY = process.binding('tty_wrap').TTY;


var qdiff = module.exports = {
    backup: backup,
    compare: compare,
};


/*
 * already-seen objects store for handling recusive objects
 */
function ObjectMap( ) {
    if (typeof Map !== 'undefined') {
        var map = new Map();
        return map;
    }
    else {
        this.keys = new Array();
        this.values = new Array();
        this.has = function(obj) { return this.keys.indexOf(obj) >= 0 };
        this.set = function(obj, copy) { this.keys.push(obj); this.values.push(copy) };
        this.get = function(obj) { var ix = this.keys.indexOf(obj); return ix >= 0 ? this.values[ix] : undefined };
        return this;
    }
}

/**
 * save the object state so it can be completely restored later
 * Object state and all properties are preserved.
 * Note that if obj contains recursive elements, the backup will also be recursive.
 */
function backup( obj, alreadySeen, depth ) {
    alreadySeen = alreadySeen || new ObjectMap();
    depth = depth || 0;
    var bak;

    // only objects and functions can have properties
    // native types and Symbols hold no properties (worse: "foo" has properties 0,1,2,length)
    //if (isSimpleValue) return { oflags: '---', value: obj, props: null, special: null };
    if (isSimpleValue(obj)) return obj;

    // if object includes a reference to itself, return the already seen reference
    if (bak = alreadySeen.get(obj)) return bak;

    var keyMap = {}, keys = Object.keys(obj);
    for (var i=0; i<keys.length; i++) keyMap[keys[i]] = keys[i];
    var propertyMap = {}, propertyNames = _getPropertyNames(obj);
    for (var i=0; i<propertyNames.length; i++) propertyMap[propertyNames[i]] = propertyNames[i];

    bak = {
        oflags: encodeObjectFlags(obj),
        value: backupValue(obj),
        //special: {},
        props: {},
    };

    alreadySeen.set(obj, bak);

// FIXME: bound functions cannot be un-bound or bound to another object!
// FIXME: a bound function will modify its original bound-to object, not the copy.
// FIXME: how to detect a bound function?
// FIXME: process.env is magic, and cannot be duplicated, but its props can be reset
// FIXME: parts of console are magic (TTY and Pipe)

// NOTE: it is 2x faster to get all property names then all descriptors than to getOwnPropertyDescriptors

// TODO: special-case array-like objects, iterate their contents by index, not get...Property
    // arrays and buffers were backed up by duplicateValue above, but copy any attached properties
    if (isArrayLike(obj)) {
        // FIXME: Buffers have properties 0,1,2,3... but no length ?! (but 0.10.42 has length, parent, offset, maybe offset)
        //   (node-v10 Buffer properties length, __proto__, constructor have a value, but no property descriptor)
        // FIXME: Arrays have "properties" 0,1,2,3... and length, none of which should be backed up or restored
        // NOTE: Buffer length, parent, offset are readable but immutable, no need to back up (and get() as null properties)
    }

    for (var i=0; i<propertyNames.length; i++) {
        var name = propertyNames[i];

        // caller, callee and arguments properties are managed by nodejs (and may not be accessed in strict mode functions)
        if (typeof obj === 'function' && (name === 'caller' || name === 'callee' || name === 'arguments')) continue;
        
        // some exotic prototype objects cannot run getters without an instance
        if (obj.constructor === TTY && (name === 'fd' || name === 'bytesRead' || name === '_externalStream')) {
            // also sometimes on console:  TypeError: Method bytesRead called on incompatible receiver #<Pipe>
//console.log("AR: object is Pipe or TTY and name='%', skipping", name);
            bak.props[name] = '<proto getter unavailable>';
            continue;
        }

        if (name === '__proto__' || name === 'constructor') {
            // TODO: ... do not access proto and constructor as properties ??
            bak.props[name] = backup(obj[name], alreadySeen, depth + 1);
            continue;
        }

        // note: a defined property does not show up with Object.keys, but does with getOwnPropertyNames
        // Ie, to restore as on original, must restore as direct property key 'K' or as defined property 'P'

//x console.log("%s -- AR: obj '%s':", new Date().toISOString(), name, typeof obj, obj.__proto__ ? true : false, obj.constructor && obj.constructor.name);
//if (typeof obj == 'function' && name == 'length') console.log("AR: names:", propertyNames);
//x if (name === 'bytesRead') console.log("AR: name:", name, propertyNames);
//x console.log("AR: about to get property descriptor '%s' of", name, typeof obj, Object.keys(obj));

// FIXME: length on Pipe calls bytesRead getter, which breaks
// FIXME: logged as
// 2018-10-05T21:24:02.289Z -- AR: obj 'length': function true Function
// AR: about to get property descriptor 'length' of function []
// => TypeError: Method bytesRead called on incompatible receiver #<Pipe>
//if (obj === Pipe && name === 'length') continue;
//x if (typeof obj === 'function' && name === 'length') console.log("AR: checking LENGTH");

//console.log("AR: getting %s.%s (depth %d)", obj.name || typeof obj, name, depth, obj.constructor && obj.constructor.name);
        var desc = Object.getOwnPropertyDescriptor(obj, name) || {};
        // NOTE: buffer 'length', 'parent', 'offset' are readable, immutable, and get() as null properties -- ok to skip

//x console.log("AR: got.");
        var pflags = (keyMap[name] ? 'K' : 'P') + (desc ? encodePropertyFlags(desc) : '---');

        if (desc.get || desc.set) {
            bak.props[name] = { pflags: pflags, value: null, get: desc.get, set: desc.set };
        }
        else if (isSimpleValue(desc.value) && pflags === 'KWEC') {
            bak.props[name] = desc.value;
        }
        else {
            bak.props[name] = { pflags: pflags, value: backup(obj[name], alreadySeen, depth + 1) };
        }
    }

    return bak;

    function encodePropertyFlags( desc ) {
        return (desc.writable ? 'W' : '-') +
               (desc.enumerable ? 'E' : '-') +
               (desc.configurable ? 'C' : '-');
    }

    function encodeObjectFlags( obj ) {
        return (objectTest('isSealed', obj) ? 'S' : '-') +
               (objectTest('isFrozen', obj) ? 'F' : '-') +
               (objectTest('isExtensible', obj) ? 'X' : '-');
    }

    function tryCall( object, method, arg ) {
        try { return object[method](arg) } catch (e) { return null }
    }

    function objectTest( testName, item ) {
        try { return Object[testName](item) }
        catch (e) { return false }
    }

/**
    // native types and Symbols hold no properties (worse: "foo" has properties 0,1,2,length)
    // error cannot redefine property: 0
    if (obj == null || typeof obj !== 'object' && typeof obj !== 'function') return { name: '(const)', backup: obj, value: obj };

    var value = typeof obj === 'object' ? backupValue(obj) : obj;
    var bak = {
        name: '(item)',
        value: value,
        magic: null,            // unique magic value that cannot be overwritten, eg process.env
        backup: value,
        props: new Array(),
        // FIXME: isSealed(process.env) crashes in node-v0.10 with "Cannot call method 'isConfigurable' of undefined"
        sealed: objectTest('isSealed', obj),
        frozen: objectTest('isFrozen', obj),
        extensible: objectTest('isExtensible', obj),
    };

    function objectTest( testName, item ) {
        try { return Object[testName](item) }
        catch (e) { return false }
    }

    alreadySeen.set(obj, bak);

    // recursively back up properties
    // getOwnPropertyNames omits Symbols (but get*Descriptors includes them)
    if (true) {
        var names = Object.getOwnPropertyNames(obj);
        if (isArrayLike(obj)) {
            while (names[0] >= 0) names.shift();
            for (var i=0; i<names.length; i++) if (names[i] === 'length') names.splice(i, 1);
        }
//console.log("AR: names", names);
        backupProperties(bak.props, obj, names, alreadySeen);
    }
    if (Object.getOwnPropertySymbols) {
        // Symbol was not present in node-v0.10
//        var names = Object.getOwnPropertySymbols(obj);
//        backupProperties(bak.props, obj, names, alreadySeen);
    }

// FIXME: bound functions cannot be un-bound or bound to another object!
// FIXME: a bound function will modify its original bound-to object, not the copy.
// FIXME: how to detect a bound function?
// FIXME: process.env is magic, and cannot be duplicated, but its props can be reset
// FIXME: parts of console are magic (TTY and Pipe)

// NOTE: it is 2x faster to get all property names then all descriptors than to getOwnPropertyDescriptors

    // back up special properties too that do not show up in the list
    if (typeof obj === 'object' || typeof obj === 'function') {
        if (obj.__proto__ !== undefined) backupProperties(bak.props, obj, ['__proto__'], alreadySeen);
        if (obj.constructor !== undefined) backupProperties(bak.props, obj, ['constructor'], alreadySeen);
    }

    function backupProperties( props, item, names, alreadySeen ) {
        for (var i=0; i<names.length; i++) {
            var name = names[i];
            // cannot directly access properties 'caller', 'callee', 'arguments' in strict mode
            // also, cannot directly access getters / setters
            var prop = Object.getOwnPropertyDescriptor(item, name);
            var value = prop ? prop.value : item[name];
            // FIXME: TTY.bytesRead throws a TypeError when read, so cannot clone the object ??
            // see https://github.com/nodejs/node/issues/17636 re exotic objects (eg process.stdin._handle.__proto__)
//console.log("AR: backing up property %s", name, value);
            if (!prop) prop = { value: value, enumerable: false, writable: true, configurable: true };
            props.push({
                // save all possible info, sort out getter vs value when restoring
// FIXME: backup also contains name:, backup:, value:
                name: name,             // name to be used by defineProperty
                value: null,            // placeholder for defineProperty value
                backup: backup(value, alreadySeen),
                writable: prop.writable,
                enumerable: prop.enumerable,
                configurable: prop.configurable,
            })
            props[props.length - 1].backup.name = name;
//if (prop.get) console.log("AR: backing up getter: ", name, prop, props.slice(-1));
        }
    }

    return bak;
**/
}


function isSimpleValue( item ) {
    return item === null || (typeof item !== 'object' && typeof item !== 'function');
}

function isHash( item ) {
    return item && typeof item === 'object' && item.constructor === Object;
}

/*
 * test whether the item is some type of Array or Buffer, ie having a length and
 * properties indexed by integers.
 */
function isArrayLike( item ) {
    // some constructor prototypes eg Buffer themselves have a constructor, but are not instanceof
    // Trying to access getter properties eg buf.buffer of such prototypes break with an error
    //   node-v8:   "Method get %TypedArray%.prototype.buffer called on incompatible receiver [object Object]"
    //   node-v5.8: "Method Uint8Array.buffer called on incompatible receiver [object Object]"
    // See https://github.com/nodejs/node/issues/17636 re "exotic objects"
    if (item && item.constructor && !(item instanceof item.constructor)) return false;

    if (item instanceof Buffer || item instanceof Array) return true;
    if (item instanceof Int8Array || item instanceof Int16Array || item instanceof Int32Array) return true;
    if (item instanceof Uint8Array || item instanceof Uint16Array || item instanceof Uint32Array) return true;
    if (item instanceof Float32Array || item instanceof Float64Array) return true;
    if (item instanceof Uint8ClampedArray) return true;
}

/*
 * return the names of readable properties of the object
 * Property names can be obtained with Object.keys and/or getOwnPropertyNames
 * and getOwnPropertySymbols.  Some properties are not visible to reflection,
 * some of those are special-cased in the code below.
 */
function _getPropertyNames( obj ) {
    var names = Object.getOwnPropertyNames(obj);

    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(obj);
        for (var i=0; i<symbols.length; i++) names.push(symbols[i]);
    }

    // __proto__ and constructor are special, they are not an own property and have no descriptor
    if (obj.__proto__ !== undefined && names.indexOf('__proto__') < 0) names.push('__proto__');
    if (obj.constructor !== undefined && names.indexOf('constructor') < 0) names.push('constructor');
    if (obj.super_ !== undefined && names.indexOf('super_') < 0) names.push('super_');

    // Buffer length, offset, parent, v4+ buffer are special, have value but no descriptor, but are immutable (v4+, mutable v0.10-0.12)
    if (isArrayLike(obj)) {
        if (names.indexOf('length') < 0 && obj.length !== undefined) names.push('length');
        if (names.indexOf('offset') < 0 && obj.offset !== undefined) names.push('offset');
        if (names.indexOf('parent') < 0 && obj.parent !== undefined) names.push('parent');
        if (names.indexOf('buffer') < 0 && obj.buffer !== undefined) names.push('buffer');
    }

    return names;
}

/*
 * duplicate the value, ignoring the properties, if any
 */
var primitiveTypes = { number: 1, string: 1, boolean: 1, symbol: 1 };
function backupValue( original ) {
    // null and undefined can hold no properties
    if (original == null) return original;
    var copy;

    // only objects and functions can hold properties
    // Symbols do not retain properties
    if (primitiveTypes[typeof original]) return original;

    // functions are bound, cannot clone the closure
    if (typeof original === 'function') return original;

    switch (original.constructor) {
    case Object:
        return {};

    case Number:
    case String:
    case Boolean:
        // these objects cannot change their state, ok to return self
        if (original instanceof original.constructor) return constructDup(original);
        break;

    case RegExp:
    case Date:
        // if object, it can have attached properties
        if (original instanceof original.constructor) return constructDup(original);
        break

    case Array:
        // array length and contents backed up as properties, subscript by subscript
        var copy = new Array(original);

        // fix nodejs new Array bug that sets length=1 for the clone of [,,2,]
        // Sparse arrays are not duplicated correctly (not by 0.10.42, not by 10.11.0).
        // E.g., x = new Array(4); x[2] = 2; y = new Array(x);  // y == [,,2,] but y.length == 1
        copy.length = original.length;

        return copy;
        break;

    //case Function:
    //    return original;        // functions are bound, cannot clone the closure

    case global.Symbol:
        return original;        // symbols are all unique, cannot clone

    // TODO: Promise, Proxy, Reflection

    case Buffer:
    case global.ArrayBuffer:
    case global.SharedArrayBuffer:
        // ArrayBuffer and SharedArrayBuffer subscripts are internal-only
        // TODO: buffer contents backed up as properties, index by index -- no need, should speed up
        // Buffer prototype is also a Buffer {} exotic objects, but cannot deref its getter fields
        if (original.constructor && original instanceof original.constructor) {
            // duplicate Buffers with Buffer.from to avoid 'new Buffer' warning
            if (original.constructor === Buffer && Buffer.allocUnsafe) copy = Buffer.allocUnsafe(original.length);
            else copy = new original.constructor(original.length);

            // copy the buffer contents, even though contents are also backed up as properties
            for (var i = 0; i < original.length; i++) copy[i] = original[i];

            return copy;
        }
        break;

    case global.Map:
    case global.WeakMap:
    case global.Set:
    case global.WeakSet:
    case global.Int8Array:
    case global.Int16Array:
    case global.Int32Array:
    case global.Uint8Array:
    case global.Uint16Array:
    case global.Uint32Array:
    case global.Uint8ClampedArray:
    case global.Float32Array:
    case global.Float64Array:
        // for these a copy can be constructed from another instance
        if (original instanceof original.constructor) return constructDup(original);
        break;
    }

    // finally, we know `original` is an object (isSimpleValue test above), and
    // the details of other objects are captured by {} annotated with all properties
    if (typeof original === 'object') return {};

    // use the item constructor to build a copy of the item
    function constructDup(item) {
        // duplicate literal string, number, boolean
//console.log("AR: duplicate", typeof item, item);
        if (typeof item !== 'object') return item.constructor(item);

        // duplicate objects with new
        // The constructor must know how to duplicate an instance of its class.
        // Exotic object prototypes eg Date {} or Buffer {} will not be instanceof.
        if (item instanceof item.constructor) return new item.constructor(item);
        else return {};

        // Date, RegExp, Map, Symbol etc prototypes are Date {}, etc exotic objects
        // distinguish by Dates are instanceof, prototypes are not
    }
}

/**
 * compare the the two hash backups and return true if same, false if different
 */
function _reject(name) { /*console.log("%s: differs", name);*/ return false }
function compare( bak1, bak2, options, name, alreadySeen ) {
    options = options || { skip: {} };
    name = name || options.name || "x";
    alreadySeen = alreadySeen || new ObjectMap();

    if (alreadySeen.get(bak2)) return true;
    alreadySeen.set(bak2, true);

    /*
     * bak == { oflags: value: props: }
     * prop == { pflags: value: } or { pflags: value:null get: set: }
     */

    // simple values must be the same
    if (isSimpleValue(bak1)) return isSimpleValue(bak2) && bak1 === bak2;

    // objects were backed up as { oflags, value } and must match
    if (!compareValue(bak1.value, bak2.value, options, name, alreadySeen)) return _reject(name);

    // object (or property) state must be the same
    if (bak1.oflags !== bak2.oflags) return _reject(name);
    if (bak1.pflags !== bak2.pflags) return _reject(name);

    // the two hashes must have the same properties
    if (bak1.props) {
        var keys1 = Object.keys(bak1.props);
        var keys2 = Object.keys(bak2.props);
        if (keys1.length !== keys2.length) return _reject(name);
        for (var k in bak1.props) {
            if (!(k in bak2.props)) return _reject(name);
            var propName = name + '.' + k;
//console.log("AR: test", propName);
            // _stdout._writableState.pendingcb differs run to run, skip
            if (options.skip[propName]) continue;
            if (!qdiff.compare(bak1.props[k], bak2.props[k], options, propName, alreadySeen)) return _reject(name + '.' + k);
        }
    }

    return true;
}

/*
 * compare the two backed-up values, return true iff same
 */
function compareValue( val1, val2, options, name, alreadySeen ) {
    if (isSimpleValue(val1)) {
        if (!isSimpleValue(val2)) return false;
        if (typeof val1 === 'number') return val1 === val2 || isNaN(val1) && isNaN(val2);
        return val1 === val2;
    }

    if (val1.constructor !== val2.constructor) return false;

    switch (val1.constructor) {
    // the only object we should get here are backups, compare them recursively
    case Object:
        return qdiff.compare(val1, val2, options, name, alreadySeen);

    // some objects have to be coerced to compare by value
    case Function: return val1 === val2;
    case Number: return +val1 === +val2 || isNaN(val1) && isNaN(val2);
    case String: return String(val1) === String(val2);
    case Boolean: return Boolean(val1) === Boolean(val2);
    case RegExp: return String(val1) === String(val2);
    case Date: return +val1 === +val2;
    case global.Symbol: return val1 === val2;

    // array-like objects (Array, Buffer, Map, etc) compared property by property
    }

    return true;
}

// quicktest:

var util = require('util');
var assert = require('assert');

var x, bak, bak2;

var bak = qdiff.backup(global);
var bak2 = qdiff.backup(global);
var bak3;
//assert.deepEqual(bak, bak2); -- breaks
// TODO: the two backups compare as different, find why
//for (var k in bak) assert.deepEqual(bak[k], bak2[k], k + ': ' + util.inspect(bak[k], {depth: 1}) + ' :: ' + util.inspect(bak2[k], {depth: 1}));

//bak = qdiff.backup([1,2,3]);
//console.log(util.inspect(bak, { depth: 10 }));

// assert.deepEqual(qdiff.backup(util), qdiff.backup(util)); //-- ok
// assert.deepEqual(qdiff.backup(assert), qdiff.backup(assert)); //-- ok

console.time('100 backups');
for (var i=0; i<100; i++) bak = qdiff.backup(global);
console.timeEnd('100 backups');
// 650 ms for 100


//var bak2 = qdiff.backup(global);
//for (var k in bak) assert.deepEqual(bak2[k], bak[k], k);

if (parseInt(process.version.slice(1)) < 6) {
    // node-v4, v5 cannot assign read-only property 'from'
    Object.defineProperty(Buffer, 'from', { writable: true, value: function(a, b, c) { return new Buffer(a, b, c) } })
}
var x = Buffer.from("foo");
bak = qdiff.backup(x);
bak2 = qdiff.backup(x);
//console.log("AR: bak", util.inspect(bak, { depth: 4 }));
//console.log("AR: bak2", util.inspect(bak2, { depth: 4 }));
assert.ok(qdiff.compare(bak, bak2));
console.time('100 compare(Buffer)');
for (var i=0; i<100; i++) qdiff.compare(bak, bak2);
console.timeEnd('100 compare(Buffer)');

var x = console;
bak = qdiff.backup(x);
bak2 = qdiff.backup(x);
assert.ok(qdiff.compare(bak, bak2, { name: 'x', skip: {
    'x._stdout._writableState.pendingcb': 1,
    'x._stdout._bytesDispatched': 1,
} }));
console.time('100 compare(console)');
for (var i=0; i<100; i++) qdiff.compare(bak, bak2);
console.timeEnd('100 compare(console)');

var x = global;
bak = qdiff.backup(x);
bak2 = qdiff.backup(x);
assert.ok(qdiff.compare(bak, bak2, { name: 'x', skip: {
    'x.console._stdout._writableState.pendingcb': 1,
    'x.console._stdout._bytesDispatched': 1,
} }));
console.time('100 compare(global)');
for (var i=0; i<100; i++) qdiff.compare(bak, bak2);
console.timeEnd('100 compare(global)');

console.log("AR: Done.");

/**/
