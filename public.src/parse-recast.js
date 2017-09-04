// import recast from 'recast'
import types from "ast-types"
const n = types.namedTypes
const b = types.builders

import _debug from 'debug'
const debug = _debug('parser')

const traverse = (rest, expand, check) => {
  if(!rest.length) return
  const node = rest.pop()
  if(check(node)) return node
  const next = [].concat(expand(node)).concat(rest)
  return traverse(next, expand, check)
}


const parse = (code) => {

  debug('CODE: \n%s\n', code)

  const ast = recast.parse(code)

  const gives = new Set
  const takes = new Set


  // ANALYSE THE AST, PULLING OUT GIVES/TAKES
  types.visit(ast, {
    visitVariableDeclaration: function(path) {

      path.node.declarations.forEach((d, i) => {
        gives.add(d.id.name)

        const node = d
        if(node.init.type == 'Identifier') {
          if(!gives.has(node.init.name))
          takes.add(node.init.name)
        }
      })

      this.traverse(path)
    },

    visitBinaryExpression: function(path) {
      const node = path.node

      if(node.left.type == 'Identifier') {
        if(!gives.has(node.left.name))
        takes.add(node.left.name)
      }

      if(node.right.type == 'Identifier') {
        if(!gives.has(node.right.name))
        takes.add(node.right.name)
      }

      this.traverse(path)
    },

    visitArrayExpression: function(path) {
      const node = path.node

      node.elements.forEach(element => {
        if(element.type == 'Identifier') {
          if(!gives.has(element.name))
          takes.add(element.name)
        }
      })

      this.traverse(path)
    },

    visitExpressionStatement: function(path) {
      const node = path.node.expression
      if(node.right && node.right.type == 'Identifier') {
        if(!gives.has(node.right.name))
        takes.add(node.right.name)
      }

      this.traverse(path)
    },

    visitCallExpression: function(path) {
      const node = path.node

      const found = traverse(
        [node.callee],
        n => n.object || [],
        n => n && n.type == "Identifier"
      )

      if(found && !gives.has(found.name)) takes.add(found.name)

      this.traverse(path)
    },

    visitTemplateLiteral: function(path) {

      const node = path.node

      node.expressions.forEach(expression => {
        if(expression.type == 'Identifier') {
          if(!gives.has(expression.name)) takes.add(expression.name)
        }
      })

      this.traverse(path)
    }
  })



  // WRAP EVERYING IN __R for repl
  types.visit(ast, {

    // Inserting REPL calls
    visitVariableDeclaration: function(path) {

      path.node.declarations.forEach((d, i) => {
        const wrap = b.callExpression(
            b.identifier("__R"),
            [d.init]
          )

        path.get("declarations", i)
          .get('init')
          .replace(wrap)


        // also stash the variable name
        gives.add(d.id.name)
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
    },

  })

  const out = recast.print(ast).code;

  debug('Gives: %o', gives)
  debug('Takes: %o', takes)

  return {
    gives: Array.from(gives),
    takes: Array.from(takes),
    code: out
  }
}

export default parse
