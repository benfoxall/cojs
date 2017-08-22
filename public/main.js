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

window.runnerWindow = loopProtect_1;

var evaluate = function evaluate(code, state, gives, takes) {
  var processed = loopProtect_1.rewriteLoops(code);

  var intrumented = processed + '; return {' + gives.join(', ') + '}';

  var args = takes.concat(intrumented);

  var fn = Function.apply(null, args);

  return fn.apply(null, takes.map(function (v) {
    return state[v];
  }));
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

      if (node.init.type == 'Identifier') {
        if (!gives.has(node.init.name)) takes.add(node.init.name);
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
        return n && n.type == "Identifier";
      });

      if (found && !gives.has(found.name)) takes.add(found.name);
    }
  });

  // console.log(ast)

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

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function createComment() {
	return document.createComment('');
}

function addListener(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function setAttribute(node, attribute, value) {
	node.setAttribute(attribute, value);
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
				code: '',
				output: ''
			};
		},
		oncreate: function oncreate() {
			var _this = this;

			this.set({ code: this.get('cell').code });
			this.set({ output: this.get('cell').output });

			var editable = this.refs.editor;

			var cm = CodeMirror.fromTextArea(editable, {
				viewportMargin: Infinity
			});

			cm.on('changes', function (e) {
				var value = cm.getValue();
				if (lastValue == value) return;
				lastValue = value;

				_this.fire('update', {
					code: value,
					ref: _this.get('cell').ref
				});
			});

			this.refs.output.appendChild(this.get('cell').iframe);

			var lastValue = void 0;
			var listener = function listener(e) {
				if (lastValue == editable.value) return;
				lastValue = editable.value;

				console.log("LISTNEER FIRED", e);

				_this.fire('update', {
					code: editable.value,
					ref: _this.get('cell').ref
				});
			};

			this.get('cell').addOutputListener(function (err, output) {
				_this.set({
					error: !!err,
					output: err || output
				});
			});

			// editable.addEventListener("DOMNodeInserted", listener, false)
			// editable.addEventListener("DOMNodeRemoved", listener, false)
			// editable.addEventListener("DOMCharacterDataModified", listener, false)


			editable.addEventListener("keydown", listener, false);
			editable.addEventListener("keyup", listener, false);
			editable.addEventListener("change", listener, false);
		}
	};
}();

function encapsulateStyles(node) {
	setAttribute(node, 'svelte-2116658666', '');
}

function add_css() {
	var style = createElement('style');
	style.id = 'svelte-2116658666-style';
	style.textContent = "[svelte-2116658666].CodeMirror,[svelte-2116658666] .CodeMirror{font-family:'Roboto Mono', monospace;height:auto}[svelte-2116658666].output,[svelte-2116658666] .output{position:relative;padding:0;display:flex}iframe[svelte-2116658666],[svelte-2116658666] iframe{width:100%;height:1em;border:none;margin-top:auto}";
	appendNode(style, document.head);
}

function create_main_fragment$1(state, component) {
	var li, div, textarea, text_2, div_1, div_1_style_value;

	return {
		create: function create() {
			li = createElement('li');
			div = createElement('div');
			textarea = createElement('textarea');
			text_2 = createText("\n  ");
			div_1 = createElement('div');
			this.hydrate();
		},

		hydrate: function hydrate(nodes) {
			encapsulateStyles(li);
			li.className = "cell";
			div.className = "input";
			textarea.value = state.code;
			div_1.className = "output";
			div_1.style.cssText = div_1_style_value = "color: " + (state.error ? '#c00' : '');
		},

		mount: function mount(target, anchor) {
			insertNode(li, target, anchor);
			appendNode(div, li);
			appendNode(textarea, div);
			component.refs.editor = textarea;
			appendNode(text_2, li);
			appendNode(div_1, li);
			component.refs.output = div_1;
		},

		update: function update(changed, state) {
			if (changed.code) {
				textarea.value = state.code;
			}

			if (changed.error && div_1_style_value !== (div_1_style_value = "color: " + (state.error ? '#c00' : ''))) {
				div_1.style.cssText = div_1_style_value;
			}
		},

		unmount: function unmount() {
			detachNode(li);
		},

		destroy: function destroy$$1() {
			if (component.refs.editor === textarea) component.refs.editor = null;
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

	if (!document.getElementById('svelte-2116658666-style')) add_css();

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
			update: function update(obj) {
				this.fire('update', obj);
			},
			add: function add(e) {
				e.preventDefault();
				this.fire('add');
			}
		}

	};
}();

function create_main_fragment(state, component) {
	var ul,
	    each_block_lookup = Object.create(null),
	    each_block_head,
	    each_block_last,
	    text,
	    button,
	    text_1;

	var each_block_value = state.cells;

	for (var i = 0; i < each_block_value.length; i += 1) {
		var key = each_block_value[i].ref;
		var each_block_iteration = each_block_lookup[key] = create_each_block(state, each_block_value, each_block_value[i], i, component, key);

		if (each_block_last) each_block_last.next = each_block_iteration;
		each_block_iteration.last = each_block_last;
		each_block_last = each_block_iteration;

		if (i === 0) each_block_head = each_block_iteration;
	}

	function each_block_destroy(iteration) {
		iteration.unmount();
		iteration.destroy();
		each_block_lookup[iteration.key] = null;
	}

	function click_handler(event) {
		component.add(event);
	}

	return {
		create: function create() {
			ul = createElement('ul');

			var each_block_iteration = each_block_head;
			while (each_block_iteration) {
				each_block_iteration.create();
				each_block_iteration = each_block_iteration.next;
			}

			text = createText("\n\n");
			button = createElement('button');
			text_1 = createText("+");
			this.hydrate();
		},

		hydrate: function hydrate(nodes) {
			button.name = "add";
			button.id = "add";
			addListener(button, 'click', click_handler);
		},

		mount: function mount(target, anchor) {
			insertNode(ul, target, anchor);

			var each_block_iteration = each_block_head;
			while (each_block_iteration) {
				each_block_iteration.mount(ul, null);
				each_block_iteration = each_block_iteration.next;
			}

			insertNode(text, target, anchor);
			insertNode(button, target, anchor);
			appendNode(text_1, button);
		},

		update: function update(changed, state) {
			var each_block_value = state.cells;

			var each_block_expected = each_block_head;
			var each_block_last = null;

			var discard_pile = [];

			for (i = 0; i < each_block_value.length; i += 1) {
				var key = each_block_value[i].ref;
				var each_block_iteration = each_block_lookup[key];

				if (each_block_iteration) each_block_iteration.update(changed, state, each_block_value, each_block_value[i], i);

				if (each_block_expected) {
					if (key === each_block_expected.key) {
						each_block_expected = each_block_expected.next;
					} else {
						if (each_block_iteration) {
							// probably a deletion
							while (each_block_expected && each_block_expected.key !== key) {
								each_block_expected.discard = true;
								discard_pile.push(each_block_expected);
								each_block_expected = each_block_expected.next;
							}

							each_block_expected = each_block_expected && each_block_expected.next;
							each_block_iteration.discard = false;
							each_block_iteration.last = each_block_last;

							if (!each_block_expected) each_block_iteration.mount(ul, null);
						} else {
							// key is being inserted
							each_block_iteration = each_block_lookup[key] = create_each_block(state, each_block_value, each_block_value[i], i, component, key);
							each_block_iteration.create();
							each_block_iteration.mount(ul, each_block_expected.first);

							each_block_expected.last = each_block_iteration;
							each_block_iteration.next = each_block_expected;
						}
					}
				} else {
					// we're appending from this point forward
					if (each_block_iteration) {
						each_block_iteration.discard = false;
						each_block_iteration.next = null;
						each_block_iteration.mount(ul, null);
					} else {
						each_block_iteration = each_block_lookup[key] = create_each_block(state, each_block_value, each_block_value[i], i, component, key);
						each_block_iteration.create();
						each_block_iteration.mount(ul, null);
					}
				}

				if (each_block_last) each_block_last.next = each_block_iteration;
				each_block_iteration.last = each_block_last;
				each_block_last = each_block_iteration;
			}

			if (each_block_last) each_block_last.next = null;

			while (each_block_expected) {
				each_block_destroy(each_block_expected);
				each_block_expected = each_block_expected.next;
			}

			for (i = 0; i < discard_pile.length; i += 1) {
				var each_block_iteration = discard_pile[i];
				if (each_block_iteration.discard) {
					each_block_destroy(each_block_iteration);
				}
			}

			each_block_head = each_block_lookup[each_block_value[0] && each_block_value[0].ref];
		},

		unmount: function unmount() {
			detachNode(ul);
			detachNode(text);
			detachNode(button);
		},

		destroy: function destroy$$1() {
			var each_block_iteration = each_block_head;
			while (each_block_iteration) {
				each_block_iteration.destroy(false);
				each_block_iteration = each_block_iteration.next;
			}

			removeListener(button, 'click', click_handler);
		}
	};
}

function create_each_block(state, each_block_value, cell, cell_index, component, key) {
	var first;

	var cell_1 = new Cell({
		_root: component._root,
		data: { cell: cell }
	});

	cell_1.on('update', function (event) {
		component.update(event);
	});

	return {
		key: key,

		first: null,

		create: function create() {
			first = createComment();
			cell_1._fragment.create();
			this.hydrate();
		},

		hydrate: function hydrate(nodes) {
			this.first = first;
		},

		mount: function mount(target, anchor) {
			insertNode(first, target, anchor);
			cell_1._fragment.mount(target, anchor);
		},

		update: function update(changed, state, each_block_value, cell, cell_index) {
			var cell_1_changes = {};
			if (changed.cells) cell_1_changes.cell = cell;
			cell_1._set(cell_1_changes);
		},

		unmount: function unmount() {
			detachNode(first);
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









var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};





var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var ENDPOINT = "https://api.cojs.co/v0";
// const ENDPOINT = 'http://localhost:3000'


// Maybe "Connection" might be better

var Session = function () {
  function Session(id) {
    var _this = this;

    classCallCheck(this, Session);

    // this.state = 'DISCONNECTED'
    this.id = id;

    this.ready = Promise.resolve(id);

    if (!id) this.ready = this.create().then(function (_ref) {
      var session = _ref.session,
          token = _ref.token;

      _this.id = session;
      _this.token = token;

      localStorage.setItem("auth-" + session, token);

      return _this.id;
    });else {
      this.token = localStorage.getItem("auth-" + id);
      // todo - handle no token & check token
    }
  }

  createClass(Session, [{
    key: "create",
    value: function create() {
      return fetch(ENDPOINT + "/session", { method: "POST" }).then(function (res) {
        return res.json();
      });
    }
  }, {
    key: "set",
    value: function set(ref, code) {
      var _this2 = this;

      return this.ready.then(function () {
        return fetch(ENDPOINT + "/cells/" + _this2.id + "/" + ref, {
          headers: {
            'Authorization': "Bearer " + _this2.token
          },
          method: "POST",
          body: code
        });
      }).then(function (res) {
        return res.status == 200 ? res : res.json().then(Promise.reject.bind(Promise));
      }).then(function (res) {
        return res.json();
      });
    }
  }, {
    key: "fetch",
    value: function (_fetch) {
      function fetch() {
        return _fetch.apply(this, arguments);
      }

      fetch.toString = function () {
        return _fetch.toString();
      };

      return fetch;
    }(function () {
      var _this3 = this;

      return this.ready.then(function () {
        return fetch(ENDPOINT + "/cells/" + _this3.id, {
          method: "GET"
        }).then(function (res) {
          return res.json();
        });
      });
    })
  }]);
  return Session;
}();

var getQueryString = function getQueryString() {
  return (document.location.search || '').replace('?', '');
};

var setQueryString = function setQueryString(qs) {
  if (window.history) window.history.pushState({}, null, '/?' + qs);else document.location = '/?' + qs;
};

var remoteStore = function remoteStore() {

  var listeners = [];
  var on = function on(event, fn) {
    listeners.push([event, fn]);
  };
  var fire = function fire(event, payload) {
    listeners.forEach(function (_ref) {
      var _ref2 = slicedToArray(_ref, 2),
          _event = _ref2[0],
          fn = _ref2[1];

      if (_event == event) fn(payload);
    });
  };

  var qs = getQueryString();
  var connection = new Session(qs);

  if (!qs) connection.ready.then(setQueryString);

  // TODO - handle invalid tokens

  connection.fetch().then(function (items) {
    items.forEach(function (item) {
      fire('cell', item);
    });
  });

  var debounces = new Map();
  var put = function put(cell) {
    clearTimeout(debounces.get(cell.ref));
    debounces.set(cell.ref, setTimeout(function () {
      connection.set(cell.ref, cell.code);
    }, 1000));
  };

  return { on: on, put: put };
};

var render = function render(node, controller) {

  var app = new App({
    target: node,
    data: { cells: [] }
  });

  // update the cells from the state
  app.set({ cells: controller.cells });

  // a new cell was added
  controller.on('added', function (cells) {
    app.set({ cells: cells });
  });

  // connect the state to remote
  var store = remoteStore();
  store.on('cell', function (cell) {
    controller.set(cell.ref, cell.code);
  });

  controller.on('cell-updated', function (cell) {
    store.put(cell);
  });

  app.on('add', function () {
    controller.add();
  });

  app.on('update', function (cell) {
    controller.set(cell.ref, cell.code);
  });
};

/**
 * Helpers.
 */

var s$1 = 1000;
var m = s$1 * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var index = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse$2(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse$2(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s$1;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s$1) {
    return Math.round(ms / s$1) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s$1, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

var debug$1 = createCommonjsModule(function (module, exports) {
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = index;

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index$$1 = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index$$1++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index$$1];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index$$1, 1);
        index$$1--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index$$1 = exports.instances.indexOf(this);
  if (index$$1 !== -1) {
    exports.instances.splice(index$$1, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}
});

var browser$1 = createCommonjsModule(function (module, exports) {
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug$1;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit');

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}
});

var debug = browser$1('iframe-eval');

window.protect = loopProtect_1.protect;

var frame_id = 0;

var iframeEvaluator = function () {
  function iframeEvaluator(iframe) {
    classCallCheck(this, iframeEvaluator);

    this.iframe = iframe;
    this.id = frame_id++;

    this.callback_id = 0;
    this.callbacks = new Map();

    this.iframe.sandbox = 'allow-scripts allow-same-origin';

    window.addEventListener('message', this);
  }

  createClass(iframeEvaluator, [{
    key: 'handleEvent',
    value: function handleEvent(e) {
      var data = e.data;


      if (this.id == data.frame_id) {
        if (data.type == 'resize') {

          this.iframe.style.height = '1px';

          this.iframe.style.height = this.iframe.contentWindow.document.body.scrollHeight + 'px';
        }
        if (data.type == 'callback') {
          var fn = this.callbacks.get(data.callback_id);
          if (fn) {
            fn(data.value);
            this.callbacks.delete(data.callback_id);
          }
        }
      }
    }

    // Hello! Welcome to this part of the code!!
    //
    // Yep, this is a function, that generates a function
    // that generates a string that evaluates to a function
    // which, when called will trigger the event handler
    // above which will in turn resolve the promise also
    // returned by the original function
    //
    // If you're interested, I will totally tell you about it
    // over a beer/wine/cocktail (you're buying, because I
    // just wrote this)
    //

  }, {
    key: 'generateCallback',
    value: function generateCallback() {
      var _this = this;

      var timeout = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1000;

      var callback_id = this.callback_id++;

      var srcGen = function srcGen() {
        var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '""';
        return '\n      ;window.parent.postMessage({\n        frame_id: ' + _this.id + ',\n        callback_id: ' + callback_id + ',\n        type: \'callback\',\n        value: ' + value + '\n      }, \'*\');\n    ';
      };
      var promise = new Promise(function (resolve, reject) {
        _this.callbacks.set(callback_id, resolve);
        setTimeout(reject, timeout);
      });

      return [srcGen, promise];
    }
  }, {
    key: 'evaluate',
    value: function evaluate(code, returns) {
      var _this2 = this;

      var state = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};


      debug('executing: \n' + code);

      var callback_id = this.callback_id++;

      var processed = loopProtect_1.rewriteLoops(code);

      window.state = state;

      var keys = Object.keys(state).filter(function (k) {
        return returns.indexOf(k) == -1;
      }).filter(function (k) {
        return k != '___';
      });

      var _generateCallback = this.generateCallback(500),
          _generateCallback2 = slicedToArray(_generateCallback, 2),
          _error = _generateCallback2[0],
          error = _generateCallback2[1];

      var _generateCallback3 = this.generateCallback(500),
          _generateCallback4 = slicedToArray(_generateCallback3, 2),
          _ready = _generateCallback4[0],
          ready = _generateCallback4[1];

      var src = '\n      <html><head>\n      <style>\n      body {\n        font-family:\'Roboto Mono\', monospace;\n        margin:0;\n      }\n      #output {\n        padding: 1.3em;\n      }\n      </style>\n      </head><body>\n        <script>\n          window.runnerWindow = window.parent\n\n          window.onerror = (err) => {\n            ' + _error('err') + '\n          }\n\n          ' + keys.map(function (k) {
        return 'const ' + k + ' = window.parent.state.' + k + ';';
      }).join(' ') + '\n\n        </script>\n        <script>\n          ' + processed + '\n        </script>\n        <script>\n          window.returns = {' + returns.join(', ') + '}\n\n          ' + _ready() + '\n\n          if(typeof(___) != \'undefined\') {\n            const div = document.createElement(\'div\')\n            div.id = \'output\'\n            div.innerText = ___\n            document.body.appendChild(div)\n          }\n\n          window.parent.postMessage({\n            frame_id: ' + this.id + ',\n            type: \'resize\'\n          }, \'*\')\n\n        </script>\n      </body></html>\n    ';

      var blob = new Blob([src], { type: 'text/html' });
      var url = URL.createObjectURL(blob);

      if (this.iframe.src) URL.revokeObjectURL(this.iframe.src);

      this.iframe.src = url;

      return new Promise(function (resolve, reject) {
        ready.then(function () {
          var result = _this2.iframe.contentWindow.returns;
          delete result.___;
          debug('output: ' + Object.keys(result));
          resolve(result);
        }).catch(reject);

        error.then(reject).catch(function () {});
      });
      return response;
    }
  }]);
  return iframeEvaluator;
}();

var Cell$2 = function () {
  function Cell(options) {
    classCallCheck(this, Cell);

    this.code = '';
    this.ref = options.ref;

    this.dirtyParse = false;
    this.dirtyEval = false;

    this.gives = [];
    this.takes = [];
    this.point = 0;

    this.output = '';
    this.state = {};

    this.parseError = null;

    this.iframe = document.createElement('iframe');
    this.evaluator = new iframeEvaluator(this.iframe);

    if (options.code) {
      this.setCode(options.code);
    }
  }

  createClass(Cell, [{
    key: 'setCode',
    value: function setCode(code) {
      if (this.code != code) {
        this.dirtyParse = this.dirtyEval = true;
        this.parseError = null;
      }
      this.code = code;
    }
  }, {
    key: 'analyse',
    value: function analyse() {
      var _this = this;

      try {
        var result = parse(this.code);
        this.point = result._;

        this.gives = result.gives;
      } catch (e) {
        this.parseError = e.description;
        this.point = -1;

        if (this.listeners) {
          this.listeners.forEach(function (fn) {
            fn(_this.parseError);
          });
        }
      } finally {
        this.dirtyParse = false;
      }
    }
  }, {
    key: 'evaluate',
    value: function evaluate$$1(state) {

      if (this.code.trim() == '') {
        if (this.listeners) {
          this.listeners.forEach(function (fn) {
            fn(null, '');
          });
        }
        return;
      }

      if (this.dirtyParse) return console.error("won't evaluate: dirty parse");

      if (this.parseError) return console.error("won't evaluate: parse error");

      var instrumented = this.code.slice(0, this.point) + ';const ___=' + this.code.slice(this.point);

      return this.evaluator.evaluate(instrumented, ['___'].concat(this.gives), state);
    }
  }, {
    key: 'addOutputListener',
    value: function addOutputListener(fn) {
      (this.listeners = this.listeners || []).push(fn);
    }

    // addCodeListener(fn) {
    //   (this.code_listeners = this.code_listeners || [])
    //   .push(fn)
    // }

  }]);
  return Cell;
}();

var Controller = function () {
  function Controller() {
    classCallCheck(this, Controller);

    this.cells = [];
    this.listeners = [];
    this.handle();
  }

  createClass(Controller, [{
    key: 'set',
    value: function set(ref, code) {

      if (!this.cells[ref]) {
        this.cells[ref] = new Cell$2({ ref: ref, code: code });
        this.fire('added', this.cells);
      } else this.cells[ref].setCode(code);

      this.handle();
      this.fire('cell-updated', this.cells[ref]);
    }
  }, {
    key: 'add',
    value: function add() {
      var ref = this.cells.length;
      this.cells = this.cells.concat(new Cell$2({ ref: ref }));

      this.handle();
      this.fire('added', this.cells);
    }
  }, {
    key: 'rm',
    value: function rm(ref) {
      console.log("todo");
    }
  }, {
    key: 'handle',
    value: function handle() {
      console.error('handler not implemented for ' + this);
    }
  }, {
    key: 'on',
    value: function on(event, listener) {
      this.listeners.push([event, listener]);
    }
  }, {
    key: 'fire',
    value: function fire(event, payload) {
      this.listeners.forEach(function (_ref) {
        var _ref2 = slicedToArray(_ref, 2),
            _event = _ref2[0],
            listener = _ref2[1];

        if (event === _event) {
          listener(payload);
        }
      });
    }
  }]);
  return Controller;
}();

// This does basic evaluation without shared state


var BasicController = function (_Controller) {
  inherits(BasicController, _Controller);

  function BasicController() {
    classCallCheck(this, BasicController);
    return possibleConstructorReturn(this, (BasicController.__proto__ || Object.getPrototypeOf(BasicController)).call(this));
  }

  createClass(BasicController, [{
    key: 'handle',
    value: function handle() {
      console.log("handle change", this.cells);

      this.cells.forEach(function (cell) {
        if (cell.dirtyParse) {
          cell.analyse();
          cell.evaluate();
        }
      });
    }
  }]);
  return BasicController;
}(Controller);

// A shared state controller


var StateController = function (_Controller2) {
  inherits(StateController, _Controller2);

  function StateController() {
    classCallCheck(this, StateController);

    var _this2 = possibleConstructorReturn(this, (StateController.__proto__ || Object.getPrototypeOf(StateController)).call(this));

    _this2.state = {};

    _this2.last = Promise.resolve();
    return _this2;
  }

  createClass(StateController, [{
    key: 'queue',
    value: function queue(pgen) {
      this.last = this.last.then(function () {
        return pgen();
      }).catch(function (e) {
        return console.log("error in queue:", e);
      });
    }
  }, {
    key: 'handle',
    value: function handle() {
      var _this3 = this;

      this.cells.forEach(function (cell) {
        if (cell.dirtyParse) {
          cell.analyse();
          _this3.queue(function () {
            return cell.evaluate(_this3.state).then(function (result) {
              Object.assign(_this3.state, result);
            }).catch(function (e) {
              cell.gives.forEach(function (k) {
                return _this3.state[k] = undefined;
              });
            });
          });
        }
      });
    }
  }]);
  return StateController;
}(Controller);

var s = document.currentScript;
if (s && s.hasAttribute('data-render')) {

  var controller = new StateController();

  render(document.body, controller);
}

exports.evaluate = evaluate;
exports.parse = parse;
exports.render = render;
exports.Session = Session;
exports.BasicController = BasicController;
exports.iframeEvaluator = iframeEvaluator;

return exports;

}({}));
