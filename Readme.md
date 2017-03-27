qhash
================================================================


Hash and object manipulation

*Work in progress*, check back soon.


Api
----------------------------------------------------------------


### qhash._merge( [target,] source [,noOverwrite] )

Deep copy the properties of the `source` hash into the `target` hash.  No sub-hash
contained in source is reused on target, each is copied recursively.  If `target`
is not specified, the `this` object is used.  If `noOverwrite` is set, existing
properties of `target` are not modified.

Hashes are javascript objects that are not instanceof any class (ie, whose
constructor is the same as the constructor of `{}`, `Object`).  Non-hash objects
are assigned directly, so any properties of class-ed objects modified on `target`
will also change on `source`.

    var dst = { };
    var src = { a: {b:2}, d: new Date() };
    qhash._merge(dst, src);
    dst.a                               // => {b:2}
    dst.a === src.a;                    // => false
    assert.deepEqual(dst.a, src.a);     // => true
    dst.d === src.d;                    // => true

### qhash.get( [source,] name )

Retrieve a property set on the `source` hash by dotted name.  Returns the property
value.  If the named property does not exist, returns `undefined`.

    qhash.get({ a: {b: 2} }, 'a');      // => {b: 2}
    qhash.get({ a: {b: 2} }, 'a.b');    // => 2
    qhash.get({ a: {b: 2} }, 'b');      // => undefined

### qhash.set( [target,] name, value )

Set a property on the `target` hash by dotted name.  Any missing internal hashes
are created as necessary.  Returns the value.

    qhash.set({}, 'a', 1);              // => { a: 1 }
    qhash.set({c:3}, 'a.b', 1);         // => { c: 3, a: {b: 1} }

### qhash.selectField( arrayOfHashes, columnName )

Retrieve the named property every hash contained in the array.  Returns an array of
values in the same order as the hashes, with `undefined` for any unset property.


### qhash.decorate( target, methods [,options] )

Attach the given methods to the target object.  The `methods` argument is a
name-value hash of the method names and method bodies to attach.

    var hash = {};
    qhash.decorate(hash, { set: qhash.set, get: qhash.get });
    hash.set === qhash.set;             // => true

Options:

- `hide` - make the attached methods non-enumerable.  Default `false`.
- `override` - overwrite existing properties by the same name as the methods.  Default `false`.


Related Work
----------------------------------------------------------------

- `util._extend()` - shallow copy `own` properties of objects
- `Object.assign()` - shallow copy properties of objects
