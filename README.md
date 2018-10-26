qhash
================================================================
[![Build Status](https://travis-ci.org/andrasq/node-qhash.svg?branch=master)](https://travis-ci.org/andrasq/node-qhash)
[![Coverage Status](https://codecov.io/github/andrasq/node-qhash/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-qhash?branch=master)

Hash and object manipulation


qhash Api
----------------------------------------------------------------

### qhash.merge( [target,] source [,noOverwrite] )

Deep copy all enumerable properties of the `source` hash into the `target` hash.  No sub-hash
contained in source is reused on target, each is copied recursively.  If `target`
is not specified, the `this` object is used.  If `noOverwrite` is set, existing
properties of `target` are not modified.  Returns `target`.

Hashes are javascript objects that are not instanceof any class (ie, whose
constructor is the same as the constructor of `{}`, `Object`).  Non-hash objects
are assumed to be class instances and are assigned directly; if their properties
are modified in `target`, they will also change in `source`.

    var dst = { };
    var src = { a: {b:2}, d: new Date() };
    qhash.merge(dst, src);
    dst.a                               // => {b:2}, hash copied
    dst.a === src.a;                    // => false, copied into new hash
    assert.deepEqual(dst.a, src.a);     // => true, hash contents match
    dst.d === src.d;                    // => true, same Date instance
    dst.d.x = 1;
    src.d.x === 1;                      // => true, same Date modified

### qhash.mmerge( target, source1 [,source2] [,source3 ...] [,noOverwrite] )

Merge multiple:  recursively deep copy all properties from all sources onto `target`
by repeatedly calling `qhash.merge`.  `Target` must be specified, there is no default.
It is safe to layer multiple read-only hashes, No sub-hash from any source is used
directly.  Returns `target`.

If `noOverwrite` is set it retains the first seen version of each set property (from
the lowest-numered source object), else retains the last seen version.

### qhash.get( [source,] name )

Retrieve a property set on the `source` hash by dotted name.  Returns the property
value.  Returns `undefined` if the named property or one of its internal hashes is
not set.

    qhash.get({ a: {b: 2} }, 'a');      // => {b: 2}
    qhash.get({ a: {b: 2} }, 'a.b');    // => 2
    qhash.get({ a: {b: 2} }, 'b');      // => undefined
    qhash.get({ a: {} }, 'a.b.c');      // => undefined

### qhash.set( [target,] name, value )

Set a property on the `target` hash by dotted name.  Any missing internal hashes
are created as necessary.  Returns the `value`.

It is possible to set a property to `undefined`, making it appear to be unset.

    var x;
    qhash.set(x = {}, 'a', 1);          // x => { a: 1 }
    qhash.set(x = {}, 'a.a.a', 1);      // x => { a: {a: {a: 1}} }
    qhash.set(x = {c:3}, 'a.b', 1);     // x => { c: 3, a: {b: 1} }

### qhash.selectField( arrayOfHashes, columnName )

Retrieve the named property from every hash in the array.  Returns an array of
values in the same order as the hashes, with `undefined` for any unset property.

    var dataset = [{a:1}, {a:2}, {c:3}];
    qhash.selectField(dataset, 'a');    // => [1, 2, undefined]
    var dataset = [{a:{b:11}}, {a:{b:22}}];
    qhash.selectField(dataset, 'a.b');  // => [11, 22]

### qhash.mapById( arrayOfObjects, idName [,intoHash] )

Map the array of objects by their `idName` property into the provided hash `intoHash`
(or into a new hash `{}`), and return the mapping.

    var dataset = [ { _id: 'one', a: 1 }, { _id: 'two', b: 2 } ];
    var hash = qhash.mapById(dataset, '_id');
    // => { one: {_id:'one', a:1}, two: {_id:'two', b:2} }

### qhash.decorate( target, methods [,options] )

Attach the given properties to the target object.  The `methods` argument is a
name-value hash of the property names and property values to attach.  This call can
be useful for decorating container objects with hidden get/set/merge methods.

Options:
* `hide` - make the attached methods non-enumerable.  Default `false`.
* `noOverwrite` - do not overwrite existing properties. Default `false`.

E.g.,

    var qhash = require('qhash');
    var hash = { a: 0 };
    qhash.decorate(hash, {set: qhash.set, get: qhash.get}, {hide: true});
    hash.set === qhash.set;             // => true
    hash.set('a', 123);
    hash.a === 123;                     // => true
    hash.get('a');                      // => 123
    Object.keys(hash);                  // => [ 'a' ]
    JSON.stringify(hash);               // => '{"a":123}'

### qhash.optimize( obj )

Convert `obj` to a struct for optimized property access.

Node objects can be hashes or structs.  A hash is tuned for unpredictable property
names; a struct for a fixed set of properties in mapped locations.  The difference
between hash and struct is invisible, but it is faster to access the properties of
a struct.

Node internally will also detect usage and eventually convert:  repeatedly
accessing the same properties on a hash will optimize it into a struct, and adding
new properties to a struct will convert it into a hash.

    var obj = new Object();             // once a hash
    obj.a = 1;
    obj.b = 2;
    qhash.optimize(obj);                // now a struct


qdiff Api
----------------------------------------------------------------

    const qdiff = require('qhash/qdiff');

### qdiff.backup( item )

Compute a backup object that captures all details of `item`.  Any modifications made
to item or any of its properties (ie objects reachable from the item), including
property or object attributes, will be reflected in a subsequent backup.

### qdiff.compare( backup1, backup2, [options] )

Compare the two backups and return `true` if they are the same, `false` if they are not.
This comparison detects added/deleted/changed contents and properties, as well as
changes to property attributes (writable, enumerable, configurable) or state (sealed,
frozen, extensible).

Options:

- `name` - the top-level object name to use, else the default is `'x'`
- `skip` - object whose properties are names of properties to not compare.  The names
  are in hierchical dotted names format, eg `{ skip: { 'x.a.b': 1 } }` meaning ignore
  differences in property a.b of `{ a: { b: 1 } }` and `{ a: { b: 2 } }`.


Change Log
----------------

- 1.3.0 - `qdiff.backup` and `qdiff.compare` functions
- 1.2.0 - `mmerge`, `mapById` functions
- 1.1.0 - `optimize` call to convert hash to struct
- 1.0.2 - fix null deref in test
- 1.0.1 - faster get/set for longer property names
- 1.0.0 - initial fixed version, 2017-03-27


Related Work
----------------------------------------------------------------

- `util._extend(to, fm)` - shallow copy (in reverse order!) of `own` properties, 8.4m/s
- `Object.assign(to, fm)` - shallow copy (in order) of `own` properties, 3.3m/s
- `Object.create(ob)` - new object with its inherited properties set to the copied object, 17m/s
- `for (key in ob)` - iterate over all enumerable properties, 16m/s copy but only 1m/s if ob has non-empty prototype
- `Object.keys(ob)` - list of enumerable `own` properties, 13m/s for just keys, 8.8m/s copy
