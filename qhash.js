/**
 * Copyright (C) 2016-2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2016-10-21 - AR.
 */

'use strict';


module.exports = {
    /*
     * Recursively copy all properties of source onto target, and return target.
     * Existing properties of target are overwritten unless noOverwrite is set.
     *
     * Note: none of the hashes from source will be assigned to target, ie the
     * source hashes will not be exposed or made writable.  Non-hash objects,
     * eg Date, RegExp, function, are assigned directly, and properties set or
     * modified on them will be changed in the source too.
     */
    merge: function merge( target, source, noOverwrite ) {
        if (typeof source !== 'object') return merge(this, target, source);

        for (var key in source) {
            if (noOverwrite && (key in target)) {
                if (isHash(target[key]) && isHash(source[key])) {
                    target[key] = merge(target[key], source[key], true);
                }
            }
            else if (isHash(source[key])) {
                var writable = isHash(target[key]) ? target[key] : {};
                target[key] = merge(writable, source[key]);
            }
            else {
                target[key] = source[key];
            }
        }

        return target;
    },

    /*
     * retrieve a configured attribute by dotted name
     */
    get: function get( target, dottedPath ) {
        if (arguments.length < 2) return this.get(this, arguments[0]);

        var noDots = true;
        for (var i=0; i<dottedPath.length; i++) if (dottedPath.charCodeAt(i) === 0x2E) { noDots = false; break; }
        if (noDots) return target[dottedPath];

        var path = dottedPath.split('.');
        for (var item=target, i=0; i<path.length; i++) {
            if (!item) return undefined;
            item = item[path[i]];
        }
        return item;
    },

    /*
     * change or define a configured attribute by dotted name
     */
    set: function set( target, dottedPath, value ) {
        if (arguments.length < 3) return this.set(this, arguments[0], arguments[1]);

        var noDots = true;
        for (var i=0; i<dottedPath.length; i++) if (dottedPath.charCodeAt(i) === 0x2E) { noDots = false; break; }
        if (noDots) return target[dottedPath] = value;

        var path = dottedPath.split('.');
        for (var item=target, i=0; i<path.length-1; i++) {
            var field = path[i];
            if (!item[field] || typeof item[field] !== 'object') item[field] = {};
            item = item[field];
        }
        return item[path[path.length-1]] = value;
    },

    /*
     * select the named column from the rows
     */
    selectField: function selectField( array, name ) {
        var ret = new Array(array.length);
        if (name.indexOf('.') < 0) {
            for (var i=0; i<array.length; i++) {
                ret[i] = array[i] != null ? array[i][name] : undefined;
            }
        } else {
            for (var i=0; i<array.length; i++) {
                ret[i] = module.exports.get(array[i], name);
            }
        }
        return ret;
    },
    pluck: 'alias of selectField',

    /*
     * decorate target with new methods
     */
    decorate: function decorate( target, methods, options ) {
        if (options) {
            var hide = options.hide;
            var noOverwrite = options.noOverwrite;
        }

        for (var name in methods) {
            if (!noOverwrite || !(name in target)) {
                target[name] = methods[name];
                if (hide) {
                    Object.defineProperty(target, name, { enumerable: false });
                }
            }
        }

        return target;
    },

    /*
     * convert the hash to a struct for optimized access
     * Node objects can be hashes or structs.  A hash is tuned for varied
     * property names; a struct for a fixed set of properties in mapped
     * locations, making property access much faster.  Adding new properties
     * to the struct converts it back into a hash.
     */
    optimize: function optimize( hash ) {
        // making an object be a class prototype makes it into a struct
        // In javascript any function, even this one, can have a prototype.
        optimize.prototype = hash;

        // leave the prototype attached to this function so it becomes a
        // permanent side-effect that cannot be null-code eliminated.

        return hash;
    },
};

// aliases
module.exports.pluck = module.exports.selectField;


/**
function indexOfCharCode( str, ch ) {
    var len = str.length;
    for (var i=0; i<len; i++) if (str.charCodeAt(i) === ch) return i;
    return -1;
}
**/


// a hash object is not instanceof any class
function isHash(o) {
    return o && typeof o === 'object' && o.constructor == Object;
}
