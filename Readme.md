qhash
================================================================


Hash and object manipulation


Api
----------------------------------------------------------------

### qhash.merge( [target,] source [,noOverwrite] )

Deep copy the properties of the `source` hash into the `target` hash.  No sub-hash
contained in source is reused on target, each is copied recursively.  If `target`
is not specified, the `this` object is used.  If `noOverwrite` is set, existing
properties of `target` are not modified.  Returns `target`.

Hashes are javascript objects that are not instanceof any class (ie, whose
constructor is the same as the constructor of `{}`, `Object`).  Non-hash objects
are assigned directly, so if any properties are modified of class instances merged
into `target` they will also change in `source`.

    var dst = { };
    var src = { a: {b:2}, d: new Date() };
    qhash.merge(dst, src);
    dst.a                               // => {b:2}, hash copied
    dst.a === src.a;                    // => false, copied into new hash
    assert.deepEqual(dst.a, src.a);     // => true, hash contents match
    dst.d === src.d;                    // => true, same Date instance
    dst.d.x = 1;
    src.d.x === 1;                      // => true, same Date modified

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
    JSON.stringify(hash);               // '{"a":123}'

Related Work
----------------------------------------------------------------

- `util._extend()` - shallow copy `own` properties of objects
- `Object.assign()` - shallow copy properties of objects
