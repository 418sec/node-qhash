qhash
================================================================


Hash and object manipulation


Api
----------------------------------------------------------------


### qhash._merge( [target,] source [,noOverwrite] )

Deep copy the properties of the `source` hash into the `target` hash.  No sub-hash
contained in source is reused on target, each is copied recursively.  If `target`
is not specified, the `this` object is used.  If `noOverwrite` is set, existing
properties of `target` are not modified.

Hashes are javascript objects that are not instanceof any class (ie, whose
constructor is the same as the constructor of `{}`, `Object`).  Non-hash objects
are assigned directly, so any object properties modified on the `target` will also
be changed on `source`.

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
