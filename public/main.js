var cojs = (function (exports) {
'use strict';

var evaluate = function evaluate(code) {
  var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var takes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var gives = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];


  var a = void 0;
  eval(code);

  return { a: a };
};

exports.evaluate = evaluate;

return exports;

}({}));
