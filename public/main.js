var cojs = (function (exports) {
'use strict';

var evaluate = function evaluate(code, state, gives, takes) {

  var intrumented = code + '; return {' + gives.join(', ') + '}';

  var args = takes.concat(intrumented);

  var fn = Function.apply(null, args);

  return fn.apply(null, takes.map(function (v) {
    return state[v];
  }));
};

exports.evaluate = evaluate;

return exports;

}({}));
