// import recast from 'recast'
import types from "ast-types"
const n = types.namedTypes
const b = types.builders

import _debug from 'debug'
const debug = _debug('parse:recast')


const parse = (code) => {

  debug('CODE:', '\n' + code)

  const ast = recast.parse(code)

  const gives = new Set

  types.visit(ast, {

    visitVariableDeclaration: function(path) {

      path.node.declarations.forEach((d, i) => {

        // stash the variable name
        gives.add(d.id.name)

        const wrap = b.callExpression(
            b.identifier("__R"),
            [d.init]
          )

        path.get("declarations", i)
          .get('init')
          .replace(wrap)

      })

      this.traverse(path)
    },

    visitExpressionStatement: function(path) {
      const wrap = b.callExpression(
          b.identifier("__R"),
          [path.node.expression]
        )
      path.get('expression').replace(wrap)
      this.traverse(path)
    }

  })


  const out = recast.print(ast).code;

  debug("GIVES:", gives)

  return {
    gives: gives,
    takes: [],
    code: out
  }
}

export default parse
