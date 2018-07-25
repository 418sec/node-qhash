/**
 * Copyright (C) 2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2018-06-25 - AR.
 */

'use strict';

module.exports = {
    clone: clone,
    backup: backup,
    restore: restore,
};


function ObjectMap( ) {
    if (typeof Map !== 'undefined') {
        var map = new Map();
        map._pos = new Array();
        map.markPosition = function() { this._pos.push(this.size) };
        map.restorePosition = function() { n = this._pos.pop(); this.forEach(function(k, v, m) { if (n-- <= 0) m.delete(k) }) };
    }
    else {
        var map = this;
        this.keys = new Array();
        this.values = new Array();
        this.has = function(obj) { return this.map.indexOf(obj) >= 0 };
        this.set = function(obj, copy) { this.keys.push(obj); this.values.push(copy) };
        this.get = function(obj) { var ix = this.keys.indexOf(obj); return ix >= 0 ? this.values[ix] : undefined };
        this._pos = new Array();
        this.markPosition = function() { this._pos.push(this.keys.length) };
        this.resetPosition = function() { var len = this._pos.pop(); this.keys.length = len; this.values.length = len };
    }
    return map;
}

/*
 * save the object state so it can be completely restored later
 * This isolates the object from its properties, so the properties
 * can be restored later.
 */
function backup( obj, mapped ) {
    mapped = mapped || new ObjectMap();

    if (mapped.has(obj)) return mapped.get(obj);

    // native types and Symbols hold no properties (worse: "foo" has properties 0,1,2,length)
    // error cannot redefine property: 0
    if (obj == null || typeof obj !== 'object' && typeof obj !== 'function') return { backup: obj, value: obj };

    var value = typeof obj === 'object' ? cloneValue(obj) : obj;
    var bak = {
        backup: value,
        value: value,
        props: new Array(),
        sealed: Object.isSealed(obj),
        frozen: Object.isFrozen(obj),
        extensible: Object.isExtensible(obj),
    };

    mapped.set(obj, bak);

    // recursively back up properties
    // getOwnPropertyNames omits Symbols (but get*Descriptors includes them)
    if (true) {
        var names = Object.getOwnPropertyNames(obj);
        if (isArrayLike(obj)) {
            while (names[0] >= 0) names.shift();
            for (var i=0; i<names.length; i++) if (names[i] === 'length') names.splice(i, 1);
        }
console.log("AR: names", names);
        backupProperties(bak.props, obj, names, mapped);
    }
    if (Object.getOwnPropertySymbols) {
        // Symbol was not present in node-v0.10
//        var names = Object.getOwnPropertySymbols(obj);
//        backupProperties(bak.props, obj, names, mapped);
    }

    // back up special properties too that do not show up in the list
    if (typeof obj === 'object' || typeof obj === 'function') {
        if (obj.__proto__ !== undefined) backupProperties(bak.props, obj, ['__proto__'], mapped);
        if (obj.constructor !== undefined) backupProperties(bak.props, obj, ['constructor'], mapped);
    }

    function isArrayLike( item ) {
        if (item instanceof String || item instanceof Buffer || item instanceof Array) return true;
        if (item instanceof Int8Array || item instanceof Int16Array || item instanceof Int32Array) return true;
        if (item instanceof Uint8Array || item instanceof Uint16Array || item instanceof Uint32Array) return true;
        if (item instanceof Float32Array || item instanceof Float64Array) return true;
    }

    function backupProperties( props, item, names, mapped ) {
        for (var i=0; i<names.length; i++) {
            var name = names[i];
            // cannot directly access properties 'caller', 'callee', 'arguments' in strict mode
            // also, cannot directly access getters / setters
            var prop = Object.getOwnPropertyDescriptor(item, name);
            var value = prop ? prop.value : item[name];
console.log("AR: backing up property %s", name, value);
            if (!prop) prop = { value: value, enumerable: false, writable: true, configurable: true };
            props.push({
                name: name,             // name to be used by defineProperty
                value: null,            // placeholder for defineProperty value
                backup: backup(value, mapped),
                writable: prop.writable,
                enumerable: prop.enumerable,
                configurable: prop.configurable,
                get: prop.get,
                set: prop.set,
            })
        }
    }

    return bak;
}


/*
 * restore the object from its backup
 * All properties and symbols will be restored as they were when backed up.
 */
function restore( backup, mapped ) {
    mapped = mapped || new ObjectMap();

    // restore a new copy each time, to preserve the original backup
    var obj = cloneValue(backup.value);
console.log("AR: cloned to", obj, backup);

    // null and non-objects can hold no properties
    if (obj == null || typeof obj !== 'object' && typeof obj !== 'function') return obj;

    if (mapped.has(backup)) return mapped.get(backup);
    mapped.set(backup, obj);

    // TODO: strip all properties that may have been added to eg a function

    // restore each property to its value at the moment of backup
    var props = backup.props;
    if (props) for (var i=0; i<props.length; i++) {
// FIXME: { a: "foo" } object is seen as non-extensible ??
console.log("AR: restore property %s", props[i].name);
        props[i].value = restore(props[i].backup, mapped);
        restoreProperty(obj, props[i]);
    }

    if (backup.sealed) Object.seal(obj);
    if (backup.frozen) Object.freeze(obj);
    if (backup.extensible === false) Object.preventExtensions(obj);

console.log("AR: restored to", obj);
    return obj;

    // restore the prop back onto the object
    function restoreProperty( obj, prop ) {
        if (prop.writable && prop.enumerable && prop.configurable) obj[prop.name] = prop.value;
        else defineProperty(obj, prop);
    }

    function defineProperty( obj, prop ) {
        try { Object.defineProperty(obj, prop.name, prop) }
        catch (err) { return err }
    }
}


/*
 * duplicate the value, ignoring the properties, if any
 */
function cloneValue( original ) {
    // null and undefined can hold no properties
    if (original == null) return original;

    // atomic types can hold no properties
    if (['number', 'string', 'boolean', 'symbol', 'function'].indexOf(typeof original) >= 0) return original;

    switch (original.constructor) {
    case Object:
        return {};

    case String:
    case Number:
    case Boolean:
    case RegExp:
    case Date:
        // the prototype of most built-in classes has the class as constructor, but is not an instance
        if (original instanceof original.constructor) return constructDup(original);
        break;

    case Array:
    case Buffer:
    case ArrayBuffer:
    case SharedArrayBuffer:
        // Array and Buffer subscripts are handled as properties
        if (original instanceof original.constructor) return constructDup(original);
        break;

    case Function: return original;     // functions are bound, cannot clone the closure
    case Symbol:   return original;     // symbols are all unique, cannot clone
    // TODO: Promise, Proxy, Reflection

    case Map:
    case WeakMap:
    case Set:
    case WeakSet:
        if (original instanceof original.constructor) return constructDup(original);
        break;

    case Int32Array:
    case Int16Array:
    case Int8Array:
    case Uint32Array:
    case Uint16Array:
    case Uint8Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
        // this test distinguishes
        if (original instanceof original.constructor) return constructDup(original);
        break;
    }

    if (typeof original === 'object') return {};

// FIXME:
throw new Error('cloneValue: unhandled original value', original);

    // use the item constructor to build a copy of the item
    function constructDup(item) {
        // duplicate literal string, number, boolean
console.log("AR: duplicate", typeof item, item);
        if (typeof item !== 'object') return item.constructor(item);

        // duplicate objects with new
        // The constructor must know how to duplicate an instance of its class.
        if (item instanceof item.constructor) return new item.constructor(item);

        // Date, RegExp, Map, Symbol etc prototype is Date {}, etc,
        // how to detect and reproduce?
    }
}

/*
 * deep-copy the object and all its properties, cloning each object along the way.
 * A clone is the same class with all same properties, but shares nothing with its source.
 * The original use case was cloning `global` for scripts run in a `vm`.
 */
function clone( original, mapped ) {

// TEST:
    var bak = backup(original);
    return restore(bak);

    mapped = mapped || new ObjectMap();

    // null and undefined can have no properties
    if (original == null) return original;

    // elemental types retain no properties
    var type = typeof original;
    if (type === 'number' || type === 'string' || type === 'boolean' || type === 'symbol') return original;

    // TODO: functions cannot be cloned (closures), so need to back up properties and restore after clone is done
    if (type === 'function') return original;

    // remember already seen object to allow self-recursion
    // TODO: this could get very slow
    var copy = mapped.get(original);
    if (copy !== undefined) return copy;

    // cloning `global` only grows to 36 objects, and not marking runs 36% faster
    // mapped.markPosition();

    // copy original
    switch (original.constructor) {
    case String:   copy = new String(original);         break;
    case Number:   copy = new Number(original);         break;
    case Array:    copy = new Array(original.length);   break;
    case RegExp:   copy = new RegExp(original);         break;
    case Date:     copy = new Date(original);           break;
    case Buffer:   copy = new Buffer(original);         break;
    case Object:   copy = {};                           break;

    case Int32Array: copy = new Int32Array(original);   break;
    case Int16Array: copy = new Int16Array(original);   break;
    case Int8Array: copy = new Int8Array(original);     break;
    case Uint32Array: copy = new Uint32Array(original); break;
    case Uint16Array: copy = new Uint16Array(original); break;
    case Uint8Array: copy = new Uint8Array(original);   break;
    case Uint8ClampedArray: copy = new Uint8ClampedArray(original); break;
    case Float32Array: copy = new Float32Array(original); break;
    case Float64Array: copy = new Float64Array(original); break;

    // TODO: older node do not export the preloaded module names, eg 'fs' and 'buffer'
    // TODO: note that theyre singletons and should clone in older node too!

    // nodejs internals
    case process.env.constructor: copy = {};            break;
    case require('events').EventEmitter: copy = {};     break;
    case process.constructor: copy = {};                break;
    case module.constructor: copy = {};                 break;
    case Object:     copy = {};                         break;

    default:
        // note: some node-v8 objects have no construtor ??
        // eg { newListener: [Function], removeListener: [Function], warning: [Function], SIGWINCH: [Function] }
        // console.log("AR: unhandled object", original, typeof original, original.constructor);
        copy = {};                                      break;
    }

    // remember this objct so we dont attempt to clone it later
    mapped.set(original, copy);

    // copy all properties of original
    if (Object.getOwnPropertySymbols) {
        var syms = Object.getOwnPropertySymbols(original);
    } else {
        var syms = [];
    }
    if (Object.getOwnPropertyDescriptors) {
        var props = Object.getOwnPropertyDescriptors(original);
        // note: symbols are listed after the non-symbol properties, not in definition order
        // note: getOwnPropertyNames omits symbols, but ...Descriptors includes it
    } else {
        var props = {};
        var propNames = Object.getOwnPropertyNames(original);
        for (var i=0; i<propNames.length; i++) props[propNames[i]] = Object.getOwnPropertyDescriptor(original, propNames[i]);
        for (var i=0; i<syms.length; i++) props[syms[i]] = Object.getOwnPropertyDescriptor(original, syms[i]);
    }

    // copy invisible properties
    if ('constructor' in original) copy.constructor = original.constructor;
    if ('__proto__' in original) copy.__proto__ = clone(original.__proto__, mapped);

    for (var k in props) {
        if (typeof props[k] !== 'object') {
            // older node had a custom process.ENV object whose keys had no properties
console.log("AR: non-obj prop", k, original[k]);
            copy[k] = original[k];
            continue;
        }

        if ('value' in props[k]) props[k].value = clone(props[k].value, mapped);
        for (var k in props) setProperty(copy, k, props[k], original);
        for (var i=0; i<syms.length; i++) setProperty(copy, syms[i], props[syms[i]], original);
        // note: symbols are distinct (ie Symbol('a') !== Symbol('a')), but can be set with [] notation
        // note: for...in does not iterate through the symbols in props
    }
//console.log(props.Error);

// FIXME: node-v4.4 has __defineGetter__ __lookupGetter__ __defineSetter__ __lookupSetter__
// FIXME: node-v4.4 non-descriptor properties: get set enumerable configurable

        // set property by string name or symbol
        function setProperty( copy, name, prop, original ) {
//console.log("AR: name", name, props[name]);
            if (props[name].writable && props[name].enumerable && props[name].configurable) copy[name] = props[name].value;
            else if (typeof props[name] === 'object') Object.defineProperty(copy, name, props[name]);
            // node node-v6.11.4 setter did not have descriptors for some properties
            else {
//console.log("AR: non-obj setProperty", name);
                copy[name] = original[name];
            }
        }

    // mapped.resetPosition();

    return copy;
}


// /**

var script = '' +
'  console.log("Hello, world!", process.pid, process.constructor);' +
'  console.log("sin", Math.sin, Math.sin(30 * 3.14159265359 / 180));' +
'  //setTimeout(function(){}, 5000);' +
'';

var vm = require('vm');
console.time('time-clone');
var origGlobal = backup(global);
//for (var i=0; i<100; i++) ctx = clone(global);
for (var i=0; i<100; i++) ctx = restore(origGlobal);
var ctx = vm.createContext(ctx);
console.timeEnd('time-clone');
// about 40ms 4.4g i7 SKL
for (var k in global) {
    if (k == 'global' || k == 'GLOBAL' || k == 'root') continue;
    if (k == 'process') continue;
    require('assert').deepEqual(global[k], ctx[k]);
}
vm.runInContext(script, ctx);
//console.log("AR: global", ctx);
//console.log("AR: ctx", ctx);

console.log("AR: done.");

/**/
