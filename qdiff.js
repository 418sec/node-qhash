/**
 * Copyright (C) 2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * 2018-06-25 - Started - AR.
 * 2018-10-11 - first working version
 * 2018-10-26 - fixed, 100% test coverage
 */

'use strict';

var util = require('util');

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
    if (typeof global.Map !== 'undefined') {
        var map = new Map();
        return map;
    }
    else {
        this.keys = new Array();
        this.values = new Array();
        this.set = function(obj, copy) { this.keys.push(obj); this.values.push(copy) };
        this.get = function(obj) { var ix = this.keys.indexOf(obj); return ix >= 0 ? this.values[ix] : undefined };
        //this.has = function(obj) { return this.keys.indexOf(obj) >= 0 };
        return this;
    }
}

/**
 * save the object state so any changes can be detected
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
        value: _backupValue(obj),
        //special: {},
        props: {},
    };

    alreadySeen.set(obj, bak);

    // notes re clone:
    //   note: how to detect a bound function?
    //   note: bound functions cannot be un-bound or bound to another object!
    //   note: a bound function will modify its original bound-to object, not the copy.
    //   note: process.env is magic, and cannot be duplicated, but its props can be reset
    //   note: parts of console are magic (TTY and Pipe)

    //   note: it is 2x faster to get all property names then all descriptors than to getOwnPropertyDescriptors

    // arrays and buffers were backed up by duplicateValue above, but copy any attached properties
    if (isArrayLike(obj)) {
        // TODO: special-case arrays and buffers, iterate contents without getDescriptor
        // note: node-v0.10.42 Bufferse have length, parent, offset, maybe offset
        // node-v8 Buffers have properties 0,1,2,3... but no length descriptor
        // node-v10 Buffer length, __proto__, constructor properties have a value, but no descriptor
        // note: some node Buffer length, parent, offset are readable but immutable, no need to back up (and get() as null properties)
        // note: sparse array defined offsets are available via Object.keys
        // note: x = []; Object.defineProperty(x, 3, { value: 7 }); sets x.length = 4 and x[3] = 7,
        //   but console.log prints [,,,[3]:7] (v0.10-v7.8) or [<4 empty items>] (v8+)
    }

    for (var i=0; i<propertyNames.length; i++) {
        var name = propertyNames[i];

        // caller, callee and arguments properties are managed by nodejs (and may not be accessed in strict mode functions)
        if (typeof obj === 'function' && (name === 'caller' || name === 'callee' || name === 'arguments')) continue;

        if (name === '__proto__' || name === 'constructor') {
            // TODO: ... do not access proto and constructor as properties ??
            bak.props[name] = backup(obj[name], alreadySeen, depth + 1);
            continue;
        }

        // note: a defined property does not show up with Object.keys, but does with getOwnPropertyNames
        // Ie, to restore as on original, must restore as direct property key 'K' or as defined property 'P'

        var desc = tryCall(Object, 'getOwnPropertyDescriptor', obj, name);
        if (desc === null) {
            // some exotic prototype objects cannot run getters without an instance,
            // work around the TypeError: Method bytesRead called on incompatible receiver #<Pipe>
            // Happens in node-v8.11.1 with Pipe for fd, bytesRead.
            bak.props[name] = { pflags: 'E---', value: '<cannot get descriptor>' };
            continue;
        }
        else if (desc === undefined) {
            // buffer 'length', 'parent', 'offset' are readable, immutable, and get() as null properties -- ok to skip
            bak.props[name] = { pflags: 'B---', value: obj[name] };
            continue;
        }

        // flags: K=keys, P=properties, E=error, B=builtin
        var pflags = (keyMap[name] ? 'K' : 'P') + encodePropertyFlags(desc);

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
        return (tryCall(Object, 'isSealed', obj) ? 'S' : '-') +         // seal()
               (tryCall(Object, 'isFrozen', obj) ? 'F' : '-') +         // freeze()
               (tryCall(Object, 'isExtensible', obj) ? 'X' : '-');      // preventExtensions()
    }
}

function tryCall( object, method, a1, a2, a3 ) {
    try { return object[method](a1, a2, a3) } catch (e) { return null }
}

function getSymbols( object ) {
    return tryCall(Object, 'getOwnPropertySymbols', object) || [];
}

function isSimpleValue( item ) {
    return item == null || (typeof item !== 'object' && typeof item !== 'function');
}

/*
 * test whether the item is some type of Array or Buffer, ie having a length and
 * properties indexed by integers.
 */
function isArrayLike( item ) {
    // must be an object
    if (!item || typeof item.constructor !== 'function') return false;

    // some constructor prototypes eg Buffer themselves have a constructor, but are not instanceof
    // Trying to access getter properties eg buf.buffer of such prototypes break with an error
    //   node-v8:   "Method get %TypedArray%.prototype.buffer called on incompatible receiver [object Object]"
    //   node-v5.8: "Method Uint8Array.buffer called on incompatible receiver [object Object]"
    // See https://github.com/nodejs/node/issues/17636 re "exotic objects"
    if (!(item instanceof item.constructor)) return false;

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

    var symbols = getSymbols(obj);
    for (var i=0; i<symbols.length; i++) names.push(symbols[i]);

    // __proto__ and constructor are special, they are not an own property and have no descriptor
    if (obj.__proto__ !== undefined && names.indexOf('__proto__') < 0) names.push('__proto__');
    if (obj.constructor !== undefined && names.indexOf('constructor') < 0) names.push('constructor');
    // constructor.super_ is enumerable

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
function _backupValue( original ) {
    var copy;

    // null, undefined and primitive types retain no properties, objects and functions do
    // if (isSimpleValue(original)) return original; // -- already screened before call

    // TODO: if the global constructor eg Array is reassigned, both Array and global.Array change!

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

    case Function:
        return original;        // functions are bound, no way to clone the closure

    //case global.Symbol:         // symbols are simple values, all unique and cannot be cloned
    //    return original;        // they cannot retain properties, but do have a constructor

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

    case global.Promise:
    case global.Proxy:
    case global.Reflection:
        // FIXME: add support
        // throw new Error('Promise, Proxy, Reflection not supported yet');
        // support as a generic object
        break;

    case global.WeakMap:
    case global.WeakSet:
        // FIXME: new WeakMap(new WeakMap) TypeError: undefined is not a function
        // throw new Error('WeakMap not supported');
        // support as a generic object
        break;

    case global.Map:
    case global.Set:
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

    // finally, the default is to back up the item as a generic object {}
    // We know `original` is an object (isSimpleValue test above), and
    // the details of objects are captured by {} annotated with all properties.
    return {};

    // use the item constructor to build a copy of the item
    function constructDup(item) {
        // duplicate literal string, number, boolean -- note: cannot occur here
        // if (typeof item !== 'object') return item.constructor(item);

        // duplicate objects with new
        // The constructor must know how to duplicate an instance of its class.
        // Exotic object prototypes eg Date {} or Buffer {} will not be instanceof.
        // return (item instanceof item.constructor) ? new item.constructor(item) : {};
        return new item.constructor(item);

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

    // the two hashes must have the same properties and same symbols with same values
    if (bak1.props) {
        var keys1 = Object.keys(bak1.props);
        if (keys1.length !== Object.keys(bak2.props).length) return _reject(name);

        var syms1 = getSymbols(bak1.props);
        if (syms1.length !== getSymbols(bak2.props).length) return _reject(name);

        var expectKeys = [].concat(keys1, syms1);
        for (var i=0; i<expectKeys.length; i++) {
            var k = expectKeys[i];
            if (!(k in bak2.props)) return _reject(name);
            var propName = (typeof k === 'symbol') ? util.inspect(k) : name + '.' + k;
            // _stdout._writableState.pendingcb differs run to run, skip
            if (options.skip[propName]) continue;
            if (!qdiff.compare(bak1.props[k], bak2.props[k], options, propName, alreadySeen)) return _reject(propName);
        }
    }

    return true;
}

/*
 * compare the two backed-up values, return true iff same
 */
function compareValue( val1, val2, options, name, alreadySeen ) {
    if (isSimpleValue(val1) || isSimpleValue(val2)) {
        if (!(isSimpleValue(val1) && isSimpleValue(val1))) return false;
        if (typeof val1 === 'number') return val1 === val2 || isNaN(val1) && isNaN(val2);
        return val1 === val2;
    }

    if (val1.constructor !== val2.constructor) return false;

    switch (val1.constructor) {
    // the only object we should get here are backups, compare them recursively
    case Object: return qdiff.compare(val1, val2, options, name, alreadySeen);

    // functions compare by value (eg bound functions; also not want equivalence proofs)
    case Function: return val1 === val2;

    // some objects have to be coerced then compare by value
    case Number: return +val1 === +val2 || isNaN(val1) && isNaN(val2);
    case String: return String(val1) === String(val2);
    case Boolean: return Boolean(val1) === Boolean(val2);
    case RegExp: return String(val1) === String(val2);
    case Date: return +val1 === +val2;
    // symbols are handled as simple values, not here
    // case global.Symbol: return val1 === val2;

    // array-like objects (Array, Buffer, Map, etc) compared property by property
    }

    return true;
}
