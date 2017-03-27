/**
 * hierarchical store
 *
 * Function library to get/set object attribues by dotted name.
 *
 * 2017-02-05 - AR.
 */

'use strict'

module.exports = {
    /*
     * retrieve a configured attribute by dotted name
     */
    get: function get( o1, dottedPath ) {
        var path = dottedPath.split('.');
        var item = o1;
        for (var i=0; i<path.length; i++) {
            if (!item) return undefined;
            item = item[path[i]];
        }
        return item;
    },

    /*
     * change or define a configured attribute by dotted name
     */
    set: function set( o1, dottedPath, value ) {
        var path = dottedPath.split('.');
        var item = o1;
        for (var i=0; i<path.length-1; i++) {
            var field = path[i];
            if (!item[field] || typeof item[field] !== 'object') item[field] = {};
            item = item[field];
        }
        item[path[path.length-1]] = value;
        return o1;
    },

    /*
     * recursively copy the properties of o2 over to o1
     * If missingOnly is true, existing properties of o1 are not overwritten.
     */
    merge: function _merge( o1, o2, missingOnly ) {
        for (var k in o2) {
            if (typeof o1[k] === 'object' &&
                typeof o2[k] === 'object' &&
                Object.prototype.toString.apply(o1[k]) === '[object Object]' &&
                Object.prototype.toString.apply(o2[k]) === '[object Object]')
            {
                _merge(o1[k], o2[k]);
            }
            else {
                if (!missingOnly || !(k in o1)) o1[k] = o2[k];
            }
        }
    },

    /*
     * decorate obj with non-enumerable methods _get, _set, _merge that
     * will operate on the values contained in obj
     */
    decorate: function decorate( obj ) {
        obj._get = function(k) { return module.exports.get(obj, k) };
        obj._set = function(k, v) { return module.exports.set(obj, k, v) };
        obj._merge = function(obj2, missingOnly) { return module.exports.merge(obj, obj2, missingOnly) };
        Object.defineProperty(obj, '_get', { enumerable: false });
        Object.defineProperty(obj, '_set', { enumerable: false });
        Object.defineProperty(obj, '_merge', { enumerable: false });
    },
};

/** quicktest:

var assert = require('assert');
var store = module.exports;

// should set values
assert.deepEqual(store.set({}, 'a', 1), {a: 1});
assert.deepEqual(store.set(store.set({}, 'a', 1), 'b', 2), {a: 1, b: 2});
assert.deepEqual(store.set({}, 'a.b.c', 2), {a: {b: {c: 2}}});
assert.deepEqual(store.set({a:123}, 'a.b.c', 2), {a: {b: {c: 2}}});
assert.deepEqual(store.set({a:123}, 'a2.b.c', 2), {a: 123, a2: {b: {c: 2}}});

// should get values
assert.deepEqual(store.get({a:3}, 'a'), 3);
assert.deepEqual(store.get({a:1, b:2, c:3}, 'a'), 1);
assert.deepEqual(store.get({a:1, b:2, c:3}, 'b'), 2);
assert.deepEqual(store.get({a:1, b:2, c:3}, 'c'), 3);

// should get hierarchical values
assert.deepEqual(store.get({a:{b:4}}, 'a'), {b:4});
assert.deepEqual(store.get({a:{b:4}}, 'a.b'), 4);
assert.deepEqual(store.get({a:{b:{c:5}}}, 'a'), {b: {c:5}});
assert.deepEqual(store.get({a:{b:{c:5}}}, 'a.b'), {c:5});
assert.deepEqual(store.get({a:{b:{c:5}}}, 'a.b.c'), 5);

// should get unset values as undefined
assert.deepEqual(store.get({}, 'a'), undefined);
assert.deepEqual(store.get({a:1}, 'b'), undefined);
assert.deepEqual(store.get({a:1, b:2, c:3}, 'z'), undefined);
assert.strictEqual(store.get({a:1, b:2, c:3}, 'z'), undefined);
assert.strictEqual(store.get({a:1, b:2, c:3}, 'a.z'), undefined);
assert.strictEqual(store.get({a:1, b:2, c:3}, 'a.b.z'), undefined);
assert.strictEqual(store.get({a:1, b:2, c:3}, 'a.b.c.z'), undefined);
assert.strictEqual(store.get({a:1, b:2, c:3}, 'a.b.c.d.z'), undefined);
assert.strictEqual(store.get({a:1}, 'x'), undefined);
assert.strictEqual(store.get({a:1, b:{}}, 'b.x'), undefined);
assert.strictEqual(store.get({a:1, b:{}}, 'x.y'), undefined);
assert.strictEqual(store.get({a:1, b:{}}, 'x.y.z'), undefined);
assert.strictEqual(store.get({a:1, b:{}}, 'b.x.y.z'), undefined);



var config = {};
module.exports.decorate(config);

config._set('A', 1);
config._set('A.B', 2);
config._set('a.b.c.d', 3);
console.log(config);

//config.a = 1;
config.b = {c: 1};
console.log(config)

console.log(config._get('a.b.c.d'));
console.log(config._get('a.b.c'));
console.log(config._get('a.b'));
console.log(config._get('a'));

/**/
