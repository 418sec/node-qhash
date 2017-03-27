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
        if (typeof source !== 'object') {
            noOverwrite = source;
            source = target;
            target = this;
        }

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

        function isHash(o) {
            // a hash object is not instanceof any class
            return o && typeof o === 'object' && o.constructor == Object;
        }
    },

    /*
     * retrieve a configured attribute by dotted name
     */
    get: function get( target, dottedPath ) {
        // TODO: would be more efficient to have a separate function for the `this` variant
        if (arguments.length < 2) return this.get(this, arguments[0]);

        var path = dottedPath.split('.');
        var item = target;

        for (var i=0; i<path.length; i++) {
            if (!item) return undefined;
            item = item[path[i]];
        }

        return item;
    },

    /*
     * change or define a configured attribute by dotted name
     */
    set: function set( target, dottedPath, value ) {
        // TODO: would be more efficient to have a separate function for the `this` variant
        if (arguments.length < 3) return this.set(this, arguments[0], arguments[1]);

        var path = dottedPath.split('.');
        var item = target;

        for (var i=0; i<path.length-1; i++) {
            var field = path[i];
            if (!item[field] || typeof item[field] !== 'object') item[field] = {};
            item = item[field];
        }

        return item[path[path.length-1]] = value;
    },

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

    decorate: function decorate( target, methods, options ) {
        if (options) {
            var hide = options.hide;
            var noOverwrite = options.noOverwrite;
        }

        for (var name in methods) {
            if (!noOverwrite || !(name in target)) {
                target[name] =  methods[name];
                if (hide) {
                    Object.defineProperty(target, name, { enumerable: false });
                }
            }
        }

        return target;
    },
};

// aliases
module.exports.pluck = module.exports.selectField;
