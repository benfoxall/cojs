var cojs = (function (exports) {
'use strict';

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var loopProtect_1 = createCommonjsModule(function (module, exports) {
/**
 * Protect against infinite loops.
 * Look for for, while and do loops, and insert a check function at the start of
 * the loop. If the check function is called many many times then it returns
 * true, preventing the loop from running again.
 */
var loopProtect = (function () {
  'use strict';
  var debug = null;

  // the standard loops - note that recursive is not supported
  var re = /\b(for|while|do)\b/g;
  var reSingle = /\b(for|while|do)\b/;
  var labelRe = /\b([a-z_]{1}\w+:)/i;
  var comments = /(?:\/\*(?:[\s\S]*?)\*\/)|(?:([\s;])+\/\/(?:.*)$)/gm;

  var loopProtect = {};

  // used in the loop detection
  loopProtect.counters = {};

  // expose debug info
  loopProtect.debug = function (state) {
    debug = state ? function () {
      console.log.apply(console, [].slice.apply(arguments));
    } : function () {};
  };

  loopProtect.debug(false); // off by default

  // the method - as this could be aliased to something else
  loopProtect.method = 'window.runnerWindow.protect';

  function inMultilineComment(lineNum, lines) {
    if (lineNum === 0) {
      return false;
    }

    var j = lineNum;
    var closeCommentTags = 1; // let's assume we're inside a comment
    var closePos = -1;
    var openPos = -1;

    do {
      j -= 1;
      debug('looking backwards ' + lines[j]);
      closePos = lines[j].indexOf('*/');
      openPos = lines[j].indexOf('/*');

      if (closePos !== -1) {
        closeCommentTags++;
      }

      if (openPos !== -1) {
        closeCommentTags--;

        if (closeCommentTags === 0) {
          debug('- exit: part of a multiline comment');
          return true;
        }
      }
    } while (j !== 0);

    return false;
  }

  function inCommentOrString(index, line) {
    var character;
    while (--index > -1) {
      character = line.substr(index, 1);
      if (character === '"' || character === '\'' || character === '.') {
        // our loop keyword was actually either in a string or a property, so let's exit and ignore this line
        debug('- exit: matched inside a string or property key');
        return true;
      }
      if (character === '/' || character === '*') {
        // looks like a comment, go back one to confirm or not
        --index;
        if (character === '/') {
          // we've found a comment, so let's exit and ignore this line
          debug('- exit: part of a comment');
          return true;
        }
      }
    }
    return false;
  }

  function directlyBeforeLoop(index, lineNum, lines) {
    reSingle.lastIndex = 0;
    labelRe.lastIndex = 0;
    var beforeLoop = false;

    var theRest = lines.slice(lineNum).join('\n').substr(index).replace(labelRe, '');
    theRest.replace(reSingle, function (match, capture, i) {
      var target = theRest.substr(0, i).replace(comments, '').trim();
      debug('- directlyBeforeLoop: ' + target);
      if (target.length === 0) {
        beforeLoop = true;
      }
      // strip comments out of the target, and if there's nothing else
      // it's a valid label...I hope!
    });

    return beforeLoop;
  }

  /**
   * Look for for, while and do loops, and inserts *just* at the start of the
   * loop, a check function.
   */
  loopProtect.rewriteLoops = function (code, offset) {
    var recompiled = [];
    var lines = code.split('\n');
    var disableLoopProtection = false;
    var method = loopProtect.method;
    var ignore = {};
    var pushonly = {};
    var labelPostion = null;

    var insertReset = function (lineNum, line, matchPosition) {
      // recompile the line with the reset **just** before the actual loop
      // so that we insert in to the correct location (instead of possibly
      // outside the logic
      return line.slice(0, matchPosition) + ';' + method + '({ line: ' + lineNum + ', reset: true }); ' + line.slice(matchPosition);
    };

    if (!offset) {
      offset = 0;
    }

    lines.forEach(function (line, lineNum) {
      // reset our regexp each time.
      re.lastIndex = 0;
      labelRe.lastIndex = 0;

      if (disableLoopProtection) {
        return;
      }

      if (line.toLowerCase().indexOf('noprotect') !== -1) {
        disableLoopProtection = true;
      }

      var index = -1;
      var matchPosition = -1;
      var originalLineNum = lineNum;
      // +1 since we're humans and don't read lines numbers from zero
      var printLineNumber = lineNum - offset + 1;
      var character = '';
      // special case for `do` loops, as they're end with `while`
      var dofound = false;
      var findwhile = false;
      var terminator = false;
      var matches = line.match(re) || [];
      var match = matches.length ? matches[0] : '';
      var labelMatch = line.match(labelRe) || [];
      var openBrackets = 0;
      var openBraces = 0;

      if (labelMatch.length) {
        debug('- label match');
        index = line.indexOf(labelMatch[1]);
        if (!inCommentOrString(index, line)) {
          if (!inMultilineComment(lineNum, lines)) {
            if (directlyBeforeLoop(index, lineNum, lines)) {
              debug('- found a label: "' + labelMatch[0] + '"');
              labelPostion = lineNum;
            } else {
              debug('- ignored "label", false positive');
            }
          } else {
            debug('- ignored label in multline comment');
          }
        } else {
          debug('- ignored label in string or comment');
        }
      }

      if (ignore[lineNum]) {
        debug(' -exit: ignoring line ' + lineNum +': ' + line);
        return;
      }

      if (pushonly[lineNum]) {
        debug('- exit: ignoring, but adding line ' + lineNum + ': ' + line);
        recompiled.push(line);
        return;
      }

      // if there's more than one match, we just ignore this kind of loop
      // otherwise I'm going to be writing a full JavaScript lexer...and god
      // knows I've got better things to be doing.
      if (match && matches.length === 1 && line.indexOf('jsbin') === -1) {
        debug('match on ' + match + '\n');

        // there's a special case for protecting `do` loops, we need to first
        // prtect the `do`, but then ignore the closing `while` statement, so
        // we reset the search state for this special case.
        dofound = match === 'do';

        // make sure this is an actual loop command by searching backwards
        // to ensure it's not a string, comment or object property
        matchPosition = index = line.indexOf(match);

        // first we need to walk backwards to ensure that our match isn't part
        // of a string or part of a comment
        if (inCommentOrString(index, line)) {
          recompiled.push(line);
          return;
        }

        // it's quite possible we're in the middle of a multiline
        // comment, so we'll cycle up looking for an opening comment,
        // and if there's one (and not a closing `*/`), then we'll
        // ignore this line as a comment
        if (inMultilineComment(lineNum, lines)) {
          recompiled.push(line);
          return;
        }

        // now work our way forward to look for '{'
        index = line.indexOf(match) + match.length;

        if (index === line.length) {
          if (index === line.length && lineNum < (lines.length-1)) {
            // move to the next line
            debug('- moving to next line');
            recompiled.push(line);
            lineNum++;
            line = lines[lineNum];
            ignore[lineNum] = true;
            index = 0;
          }

        }

        while (index < line.length) {
          character = line.substr(index, 1);
          // debug(character, index);

          if (character === '(') {
            openBrackets++;
          }

          if (character === ')') {
            openBrackets--;

            if (openBrackets === 0 && terminator === false) {
              terminator = index;
            }
          }

          if (character === '{') {
            openBraces++;
          }

          if (character === '}') {
            openBraces--;
          }

          if (openBrackets === 0 && (character === ';' || character === '{')) {
            // if we're a non-curlies loop, then convert to curlies to get our code inserted
            if (character === ';') {
              if (lineNum !== originalLineNum) {
                debug('- multiline inline loop');
                // affect the compiled line
                recompiled[originalLineNum] = recompiled[originalLineNum].substring(0, terminator + 1) + '{\nif (' + method + '({ line: ' + printLineNumber + ' })) break;\n' + recompiled[originalLineNum].substring(terminator + 1);
                line += '\n}\n';
              } else {
                // simpler
                debug('- single line inline loop');
                line = line.substring(0, terminator + 1) + '{\nif (' + method + '({ line: ' + printLineNumber + ' })) break;\n' + line.substring(terminator + 1) + '\n}\n';
              }

            } else if (character === '{') {
              debug('- multiline with braces');
              var insert = ';\nif (' + method + '({ line: ' + printLineNumber + ' })) break;\n';
              line = line.substring(0, index + 1) + insert + line.substring(index + 1);

              index += insert.length;
            }

            // work out where to put the reset
            if (lineNum === originalLineNum && labelPostion === null) {
              debug('- simple reset insert');
              line = insertReset(printLineNumber, line, matchPosition);
              index += (';' + method + '({ line: ' + lineNum + ', reset: true }); ').length;
            } else {
              // insert the reset above the originalLineNum OR if this loop used
              // a label, we have to insert the reset *above* the label
              if (labelPostion === null) {
                debug('- reset inserted above original line');
                recompiled[originalLineNum] = insertReset(printLineNumber, recompiled[originalLineNum], matchPosition);
              } else {
                debug('- reset inserted above matched label on line ' + labelPostion);
                if (recompiled[labelPostion] === undefined) {
                  labelPostion--;
                  matchPosition = 0;
                }
                recompiled[labelPostion] = insertReset(printLineNumber, recompiled[labelPostion], matchPosition);
                labelPostion = null;
              }
            }

            recompiled.push(line);

            if (!dofound) {
              return;
            } else {
              debug('searching for closing `while` statement for: ' + line);
              // cycle forward until we find the close brace, after which should
              // be our while statement to ignore
              findwhile = false;
              while (index < line.length) {
                character = line.substr(index, 1);

                if (character === '{') {
                  openBraces++;
                }

                if (character === '}') {
                  openBraces--;
                }

                // debug(character, openBraces);

                if (openBraces === 0) {
                  findwhile = true;
                } else {
                  findwhile = false;
                }

                if (openBraces === 0) {
                  debug('outside of closure, looking for `while` statement: ' + line);
                }

                if (findwhile && line.indexOf('while') !== -1) {
                  debug('- exit as we found `while`: ' + line);
                  pushonly[lineNum] = true;
                  return;
                }

                index++;

                if (index === line.length && lineNum < (lines.length-1)) {
                  lineNum++;
                  line = lines[lineNum];
                  debug(line);
                  index = 0;
                }
              }
              return;
            }
          }

          index++;

          if (index === line.length && lineNum < (lines.length-1)) {
            // move to the next line
            debug('- moving to next line');
            recompiled.push(line);
            lineNum++;
            line = lines[lineNum];
            ignore[lineNum] = true;
            index = 0;
          }
        }
      } else {
        // else we're a regular line, and we shouldn't be touched
        debug('regular line ' + line);
        recompiled.push(line);
      }
    });

    debug('---- source ----');
    debug(code);
    debug('---- rewrite ---');
    debug(recompiled.join('\n'));
    debug('');

    return disableLoopProtection ? code : recompiled.join('\n');
  };

  /**
   * Injected code in to user's code to **try** to protect against infinite
   * loops cropping up in the code, and killing the browser. Returns true
   * when the loops has been running for more than 100ms.
   */
  loopProtect.protect = function (state) {
    loopProtect.counters[state.line] = loopProtect.counters[state.line] || {};
    var line = loopProtect.counters[state.line];
    var now = (new Date()).getTime();

    if (state.reset) {
      line.time = now;
      line.hit = 0;
      line.last = 0;
    }

    line.hit++;
    if ((now - line.time) > 100) {//} && line.hit !== line.last+1) {
      // We've spent over 100ms on this loop... smells infinite.
      var msg = 'Exiting potential infinite loop at line ' + state.line + '. To disable loop protection: add "// noprotect" to your code';
      if (window.proxyConsole) {
        window.proxyConsole.error(msg);
      } else {
        console.error(msg);
      }
      // Returning true prevents the loop running again
      return true;
    }
    line.last++;
    return false;
  };

  loopProtect.reset = function () {
    // reset the counters
    loopProtect.counters = {};
  };

  return loopProtect;

}());

{
  module.exports = loopProtect;
}
});

loopProtect_1.method = '__protect';

var evaluate = function evaluate(code, state, gives, takes) {

  var processed = loopProtect_1.rewriteLoops(code);

  var intrumented = processed + '; return {' + gives.join(', ') + '}';

  var args = takes.concat('__protect').concat(intrumented);

  var fn = Function.apply(null, args);

  return fn.apply(null, takes.map(function (v) {
    return state[v];
  }).concat(loopProtect_1.protect));
};

// Depth first search
var traverse = function traverse(rest, expand, check) {
  var node = rest.pop();
  if (check(node)) return node;
  var next = [].concat(expand(node)).concat(rest);
  return traverse(next, expand, check);
};

var parse = function parse(code) {

  var declaresVariable = function declaresVariable(node) {
    return node.type == 'VariableDeclarator';
  };

  var gives = new Set();
  var takes = new Set();

  var ast = esprima.parseScript(code, { range: true }, function (node, meta) {
    if (declaresVariable(node)) {
      gives.add(node.id.name);
    }

    if (node.type == 'AssignmentExpression' && node.operator == '=') {
      if (node.left.type == 'Identifier') {
        gives.add(node.left.name);
      }

      if (node.right.type == 'Identifier') {
        if (!gives.has(node.right.name)) takes.add(node.right.name);
      }
    }

    if (node.type == 'BinaryExpression') {
      if (node.left.type == 'Identifier') {
        if (!gives.has(node.left.name)) takes.add(node.left.name);
      }

      if (node.right.type == 'Identifier') {
        if (!gives.has(node.right.name)) takes.add(node.right.name);
      }
    }

    if (node.type == 'CallExpression') {

      var found = traverse([node.callee], function (n) {
        return n.object;
      }, function (n) {
        return n.type == "Identifier";
      });

      if (found && !gives.has(found.name)) takes.add(found.name);
    }
  });

  console.log(ast);

  // shallow look for where we could inject extra return
  var last_expression_index = 0;

  ast.body.forEach(function (node) {
    if (node.type == 'ExpressionStatement') {
      last_expression_index = node.range[0];
    }
  });

  return {
    gives: Array.from(gives),
    takes: Array.from(takes),
    '_': last_expression_index
  };
};

function noop() {}

function assign(target) {
	var k,
		source,
		i = 1,
		len = arguments.length;
	for (; i < len; i++) {
		source = arguments[i];
		for (k in source) target[k] = source[k];
	}

	return target;
}

function appendNode(node, target) {
	target.appendChild(node);
}

function insertNode(node, target, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function destroyEach(iterations, detach, start) {
	for (var i = start; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].destroy(detach);
	}
}

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function destroy(detach) {
	this.destroy = this.set = this.get = noop;
	this.fire('destroy');

	if (detach !== false) this._fragment.unmount();
	this._fragment.destroy();
	this._fragment = this._state = null;
}

function differs(a, b) {
	return a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function dispatchObservers(component, group, changed, newState, oldState) {
	for (var key in group) {
		if (!changed[key]) continue;

		var newValue = newState[key];
		var oldValue = oldState[key];

		var callbacks = group[key];
		if (!callbacks) continue;

		for (var i = 0; i < callbacks.length; i += 1) {
			var callback = callbacks[i];
			if (callback.__calling) continue;

			callback.__calling = true;
			callback.call(component, newValue, oldValue);
			callback.__calling = false;
		}
	}
}

function get(key) {
	return key ? this._state[key] : this._state;
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		handlers[i].call(this, data);
	}
}

function observe(key, callback, options) {
	var group = options && options.defer
		? this._observers.post
		: this._observers.pre;

	(group[key] || (group[key] = [])).push(callback);

	if (!options || options.init !== false) {
		callback.__calling = true;
		callback.call(this, this._state[key]);
		callback.__calling = false;
	}

	return {
		cancel: function() {
			var index = group[key].indexOf(callback);
			if (~index) group[key].splice(index, 1);
		}
	};
}

function on(eventName, handler) {
	if (eventName === 'teardown') return this.on('destroy', handler);

	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set(newState) {
	this._set(assign({}, newState));
	if (this._root._lock) return;
	this._root._lock = true;
	callAll(this._root._beforecreate);
	callAll(this._root._oncreate);
	callAll(this._root._aftercreate);
	this._root._lock = false;
}

function _set(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign({}, oldState, newState);
	this._recompute(changed, this._state, oldState, false);
	if (this._bind) this._bind(changed, this._state);
	dispatchObservers(this, this._observers.pre, changed, this._state, oldState);
	this._fragment.update(changed, this._state);
	dispatchObservers(this, this._observers.post, changed, this._state, oldState);
}

function callAll(fns) {
	while (fns && fns.length) fns.pop()();
}

var proto = {
	destroy: destroy,
	get: get,
	fire: fire,
	observe: observe,
	on: on,
	set: set,
	teardown: destroy,
	_recompute: noop,
	_set: _set
};

var template$1 = function () {
	return {
		data: function data() {
			return {
				output: '-'
			};
		},
		oncreate: function oncreate() {
			var _this = this;

			var editable = this.refs.editor;

			var listener = function listener(e) {
				_this.fire('codeupdate', {
					code: editable.innerText,
					cell: _this.get('cell')
				});
			};

			editable.addEventListener("DOMNodeInserted", listener, false);
			editable.addEventListener("DOMNodeRemoved", listener, false);
			editable.addEventListener("DOMCharacterDataModified", listener, false);

			this.get('cell').addResultListener(function (r) {
				console.log(r);
				_this.set('output', r);
				_this.refs.output.textContent = r;
			});
		}
	};
}();

function create_main_fragment$1(state, component) {
	var li,
	    div,
	    text_value = state.cell.code,
	    text,
	    text_1,
	    div_1,
	    text_2;

	return {
		create: function create() {
			li = createElement('li');
			div = createElement('div');
			text = createText(text_value);
			text_1 = createText("\n  ");
			div_1 = createElement('div');
			text_2 = createText(state.output);
			this.hydrate();
		},

		hydrate: function hydrate(nodes) {
			li.className = "cell";
			div.className = "input";
			div.contentEditable = true;
			div_1.className = "output";
		},

		mount: function mount(target, anchor) {
			insertNode(li, target, anchor);
			appendNode(div, li);
			component.refs.editor = div;
			appendNode(text, div);
			appendNode(text_1, li);
			appendNode(div_1, li);
			component.refs.output = div_1;
			appendNode(text_2, div_1);
		},

		update: function update(changed, state) {
			if (changed.cell && text_value !== (text_value = state.cell.code)) {
				text.data = text_value;
			}

			if (changed.output) {
				text_2.data = state.output;
			}
		},

		unmount: function unmount() {
			detachNode(li);
		},

		destroy: function destroy$$1() {
			if (component.refs.editor === div) component.refs.editor = null;
			if (component.refs.output === div_1) component.refs.output = null;
		}
	};
}

function Cell(options) {
	options = options || {};
	this.refs = {};
	this._state = assign(template$1.data(), options.data);

	this._observers = {
		pre: Object.create(null),
		post: Object.create(null)
	};

	this._handlers = Object.create(null);

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	var oncreate = template$1.oncreate.bind(this);

	if (!options._root) {
		this._oncreate = [oncreate];
	} else {
		this._root._oncreate.push(oncreate);
	}

	this._fragment = create_main_fragment$1(this._state, this);

	if (options.target) {
		this._fragment.create();
		this._fragment.mount(options.target, null);
	}

	if (!options._root) {
		callAll(this._oncreate);
	}
}

assign(Cell.prototype, proto);

var template = function () {
	return {
		methods: {
			update: function update(_ref) {
				var code = _ref.code,
				    cell = _ref.cell;


				console.log("code updated", code);
				console.log(cell);
				cell.setCode(code);

				// this would be done elsewhere
				cell.analyse();
				cell.evaluate();

				console.log(cell.output);
			}
		}

	};
}();

function create_main_fragment(state, component) {
	var ul, text, button, text_1;

	var each_block_value = state.cells;

	var each_block_iterations = [];

	for (var i = 0; i < each_block_value.length; i += 1) {
		each_block_iterations[i] = create_each_block(state, each_block_value, each_block_value[i], i, component);
	}

	return {
		create: function create() {
			ul = createElement('ul');

			for (var i = 0; i < each_block_iterations.length; i += 1) {
				each_block_iterations[i].create();
			}

			text = createText("\n\n");
			button = createElement('button');
			text_1 = createText("+");
			this.hydrate();
		},

		hydrate: function hydrate(nodes) {
			button.name = "add";
			button.id = "add";
		},

		mount: function mount(target, anchor) {
			insertNode(ul, target, anchor);

			for (var i = 0; i < each_block_iterations.length; i += 1) {
				each_block_iterations[i].mount(ul, null);
			}

			insertNode(text, target, anchor);
			insertNode(button, target, anchor);
			appendNode(text_1, button);
		},

		update: function update(changed, state) {
			var each_block_value = state.cells;

			if (changed.cells || changed.event) {
				for (var i = 0; i < each_block_value.length; i += 1) {
					if (each_block_iterations[i]) {
						each_block_iterations[i].update(changed, state, each_block_value, each_block_value[i], i);
					} else {
						each_block_iterations[i] = create_each_block(state, each_block_value, each_block_value[i], i, component);
						each_block_iterations[i].create();
						each_block_iterations[i].mount(ul, null);
					}
				}

				for (; i < each_block_iterations.length; i += 1) {
					each_block_iterations[i].unmount();
					each_block_iterations[i].destroy();
				}
				each_block_iterations.length = each_block_value.length;
			}
		},

		unmount: function unmount() {
			detachNode(ul);

			for (var i = 0; i < each_block_iterations.length; i += 1) {
				each_block_iterations[i].unmount();
			}

			detachNode(text);
			detachNode(button);
		},

		destroy: function destroy$$1() {
			destroyEach(each_block_iterations, false, 0);
		}
	};
}

function create_each_block(state, each_block_value, cell, cell_index, component) {

	var cell_1 = new Cell({
		_root: component._root,
		data: { cell: cell }
	});

	cell_1.on('codeupdate', function (event) {
		component.update(event);
	});

	return {
		create: function create() {
			cell_1._fragment.create();
		},

		mount: function mount(target, anchor) {
			cell_1._fragment.mount(target, anchor);
		},

		update: function update(changed, state, each_block_value, cell, cell_index) {
			var cell_1_changes = {};
			if (changed.cells) cell_1_changes.cell = cell;
			cell_1._set(cell_1_changes);
		},

		unmount: function unmount() {
			cell_1._fragment.unmount();
		},

		destroy: function destroy$$1() {
			cell_1.destroy(false);
		}
	};
}

function App(options) {
	options = options || {};
	this._state = options.data || {};

	this._observers = {
		pre: Object.create(null),
		post: Object.create(null)
	};

	this._handlers = Object.create(null);

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	if (!options._root) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment(this._state, this);

	if (options.target) {
		this._fragment.create();
		this._fragment.mount(options.target, null);
	}

	if (!options._root) {
		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign(App.prototype, template.methods, proto);

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var Cell$2 = function () {
  function Cell() {
    classCallCheck(this, Cell);

    this.code = '';

    this.dirtyParse = false;
    this.dirtyEval = false;

    this.gives = [];
    this.takes = [];
    this.point = 0;

    this.result = undefined;
    this.state = {};
  }

  createClass(Cell, [{
    key: 'setCode',
    value: function setCode(code) {
      if (this.code != code) {
        this.dirtyParse = this.dirtyEval = true;
      }

      this.code = code;
    }
  }, {
    key: 'analyse',
    value: function analyse() {
      var result = parse(this.code);

      console.log("got result, ", result);

      // todo gives & takes

      this.point = result._;
      this.dirtyParse = false;
    }
  }, {
    key: 'evaluate',
    value: function evaluate$$1() {
      var _this = this;

      if (this.dirtyParse) return console.error("won't evaluate: dirty parse");

      var instrumented = this.code.slice(0, this.point) + ';const ___=' + this.code.slice(this.point);

      console.log(instrumented);

      this.state = evaluate(instrumented, {}, ['___'], []);

      this.result = this.state.___;

      console.log(this.state);

      if (this.listeners) {
        this.listeners.forEach(function (fn) {
          fn(_this.result);
        });
      }
    }
  }, {
    key: 'addResultListener',
    value: function addResultListener(fn) {
      (this.listeners = this.listeners || []).push(fn);
    }
  }]);
  return Cell;
}();

var render = function render(node) {

  var app = new App({
    target: node,
    data: { cells: [] }
  });

  var cells = [];

  window.cells = cells;

  cells.push(new Cell$2());
  cells.push(new Cell$2());

  cells[0].setCode('const a = 123\nconst b = 12\nconst c = 1245\n\nx = a + b + c');

  app.set({
    cells: cells
  });
};

// const ENDPOINT = "https://api.cojs.co/v0"
var ENDPOINT = 'http://localhost:3000';

// Maybe "Store" might be better

var Session = function () {
  function Session(id) {
    var _this = this;

    classCallCheck(this, Session);

    // this.state = 'DISCONNECTED'
    this.id = id;

    this.ready = Promise.resolve();

    if (!id) this.ready = this.create().then(function (_ref) {
      var session = _ref.session,
          token = _ref.token;

      _this.id = session;
      _this.token = token;

      localStorage.setItem('auth-' + session, token);
    });else {
      this.token = localStorage.getItem('auth-' + id);
      // todo - handle no token & check token
    }
  }

  createClass(Session, [{
    key: 'create',
    value: function create() {
      return fetch(ENDPOINT + '/session', {
        method: "POST"
      }).then(function (res) {
        return res.json();
      }).catch(function (res) {
        console.log(res);
      });
    }
  }, {
    key: 'set',
    value: function set(ref, code) {
      var _this2 = this;

      return this.ready.then(function () {
        return fetch(ENDPOINT + '/cell', {
          headers: {
            'Authorization': 'Bearer ' + _this2.token
          },
          method: "POST",
          body: JSON.stringify({
            session: _this2.id,
            ref: ref,
            code: code
          })
        });
      }).then(function (res) {
        return res.json();
      });
    }
  }, {
    key: 'fetch',
    value: function (_fetch) {
      function fetch() {
        return _fetch.apply(this, arguments);
      }

      fetch.toString = function () {
        return _fetch.toString();
      };

      return fetch;
    }(function () {
      return fetch(ENDPOINT + '/cells/' + this.id, {
        method: "GET"
      }).then(function (res) {
        return res.json();
      });
    })
  }]);
  return Session;
}();

var s = document.currentScript;
if (s && s.hasAttribute('data-render')) render(document.body);

var session = new Session();

window.s = session;

Promise.all([session.set(3, 'hello world!!!! LAST'), session.set(0, 'hello world'), session.set(1, 'hello world!!!! NO NO NO')]).then(function () {
  console.log("done");

  session.fetch().then(function (items) {
    console.table(items);
  });
});

console.log(session);

exports.evaluate = evaluate;
exports.parse = parse;
exports.render = render;
exports.Session = Session;

return exports;

}({}));
