/*

Simple data to HTML binding.

Requires:

setters/gettings, bind, qSA, getOwnPropertyNames, forEach - basically a decent browser

Arguments:

- obj: this is your data structure that is copied in to the Bind
- mapping: this is a key/value pair of object path to DOM selector

Example:

var data = Bind({
  me: {
    name: "@rem",
    score: 11
  }
}, {
  'me.score': '#score',
  'me.name': '#name'
});

Restrictions:

Only supports simple changes to the object - if you change the structure, then the bindings are lost.

i.e. this won't work:

var data = Bind({...}, {...});

data.me.name = '@leftlogic'; //works
data.me = { // fails
  name: '@rem'
}

*/
var Bind = (function (global) {

  // this is a conditional because we're also supporting node environment
  var $ = global.document ? document.querySelectorAll.bind(document) : function () {},
    forEach = [].forEach,
    _push = [].push;

var array = [];

  function AugmentArray(callback) {
    this.__callback = callback;
    return this;
  }

  AugmentArray.prototype = new Array();

  function extend(target, object, settings, _path) {
    if (!_path) { _path = []; }
    // loop through each property, and make getters & setters for
    // each type of "regular" value. If the key/value pair is an
    // object, then recursively call extend with the target and
    // object as the next level down.
    Object.getOwnPropertyNames(object).forEach(function (key) {
      var value = object[key];
      // create a new copy of the mapping path
      var path = [].slice.call(_path);
      var callback;

      // now create a path, so that obj { user: { name: xxx }} is
      // user.name when joined later.
      path.push(key);

      // look for the path in the mapping arg, and if the gave
      // us a callback, use that, otherwise...
      if (typeof settings.mapping[path.join('.')] === 'function') {
        callback = settings.mapping[path.join('.')];
      } else if (settings.mapping[path.join('.')]) {
        // create a callback that loops over *all* the elements
        // matched from the selector (set up below), that checks
        // the node type, and either sets the input.value or
        // element.innerHTML to the value
        callback = function (value) {
          if (callback.elements) {
            forEach.call(callback.elements, function (element) {
              if (element.nodeName !== 'INPUT') {
                // most common path
                element.innerHTML = value;
              } else {
                element.value = value;
              }
            });
          }
        };

        // finally, cache the matched elements. Note the :) is
        // because qQA won't allow an empty (or undefined) string
        // so I like the smilie.
        callback.elements = $(settings.mapping[path.join('.')] || '☺');
      }

      // don't die trying...
      try {

        // set up a setter and getter for this property.
        // if the set value is another object, iterate over it, re-extending
        // so it gets these setters and getters on the set object properties.
        // when the setter is called, check if there's a callback, if so: fire.
        Object.defineProperty(target, key, {
          // configurable to allow object properties to be later deleted
          configurable: true,
          enumerable: true,
          set: function (v) {
            var old = value !== v ? value : undefined;
            var oldparent,
                parentIsArray = target instanceof AugmentArray || Array.isArray(target);

            // if the parent object is an array - then capture the old state too
            if (parentIsArray) {
              oldparent = target.slice(0);
            }

            // if the value we're setting is an object, enumerate the properties
            // and apply new setter & getters, returning our bound object
            if (settings.ready && typeof v === "object" && v !== null && !Array.isArray(v)) {
              value = extend(target[key] || {}, v, settings, path);
            // } else if (Array.isArray(value)) {
              // value = extend(new AugmentArray(callback), v, settings, path);
            } else {
              value = v;
            }

            // only fire the callback immediately when the initial data binding
            // is set up. If it's not, then defer until complete
            if (settings.ready && callback) {
              callback(value, old);
            } else if (callback) {
              settings.deferred.push(function (callback, value, old) {
                callback(value, old);
              }.bind(null, callback, value, old));
            }

            if (!callback && parentIsArray) {
              // trigger a change on the parent array
              if (settings.ready && target.__callback) {
                target.__callback(target, oldparent);
              } else if (target.__callback) {
                settings.deferred.push(function (callback, value, old) {
                  callback(value, old);
                }.bind(null, target.__callback, target, oldparent));
              }
            }
          },
          get: function () {
            return value;
          }
        });
      } catch (e) {
        // console.log(e.toString(), e.stack);
      }

      // finally, set the target aka the returned value's property to the value
      // we're iterating over. note that this means the callbacks are fired
      // right away - so we defer the callbacks on first run until the set up is
      // finished.
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        target[key] = extend(target[key] || {}, value, settings, path);
      } else if (Array.isArray(value)) {
        target[key] = extend(new AugmentArray, value, settings, path);
        target[key].__callback = callback;
      } else {
        target[key] = value;
      }
    });

    return target;
  }

  function Bind(obj, mapping) {
    if (!this || this === global) {
      return new Bind(obj, mapping);
    }

    var settings = {
      mapping: mapping,
      deferred: [],
      ready: false
    };

    extend(this, obj, settings);

    // allow object updates to happen now, otherwise we end up iterating the
    // setter & getter methods, which causes multiple callbacks to run
    settings.ready = true;

    // if there's deferred callbacks, let's hit them now the binding is set up
    if (settings.deferred.length) {
      setTimeout(function () {
        settings.deferred.forEach(function (fn) {
          fn();
        });
      }, 0);
    }

    return this;
  };

  // returns a vanilla object - without setters & getters
  Bind.prototype.__export = function () {
    function extend(target, object) {
      Object.getOwnPropertyNames(object).forEach(function (key) {
        var value = object[key];

        // ignore properties on the prototype (pretty sure there's a better way)
        if (Bind.prototype[key]) {
          return;
        }

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          target[key] = extend(target[key] || {}, value);
        } else {
          target[key] = value;
        }
      });
      return target;
    }

    return extend({}, this);
  };

  return Bind;

})(this);

if (typeof exports !== 'undefined') {
  module.exports = Bind;
}
