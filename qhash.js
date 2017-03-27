/**
 * default config layer
 *
 * 2016-10-21 - AR.
 */

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
            return o && typeof o === 'object' &&
                o.constructor &&
                o.constructor.name === 'Object';
        }
    },

    /*
     * retrieve a configured attribute by dotted name
     */
    get: function get( target, dottedPath ) {
        if (arguments.length < 3) { value = dottedPath; dottedPath = target; target = this }
        var path = dottedPath.split('.');
        var item = target ? target : this;
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
        if (arguments.length < 3) { value = dottedPath; dottedPath = target; target = this }
        var path = dottedPath.split('.');
        var item = target ? target : this;
        for (var i=0; i<path.length-1; i++) {
            var field = path[i];
            if (!item[field] || typeof item[field] !== 'object') item[field] = {};
            item = item[field];
        }
        return item[path[path.length-1]] = value;
    },
};

// hide _merge, get and set from casual inspection
Object.defineProperty(module.exports, '_merge', { enumerable: false });
Object.defineProperty(module.exports, 'get', { enumerable: false });
Object.defineProperty(module.exports, 'set', { enumerable: false });


/** quicktest:

var config = module.exports;

config.set('A', 1);
config.set('A.B', 2);
config.set('a.b.c.d', 3);

//config.a = 1;
config.b = {c: 1};

console.log(config)
console.log(config.get('a.b.c.d'));
console.log(config.get('a.b'));

/**/
