
// Depth first search
const traverse = (rest, expand, check) => {
  const node = rest.pop()
  if(check(node)) return node
  const next = [].concat(expand(node)).concat(rest)
  return traverse(next, expand, check)
}


const parse = (code) => {

  const declaresVariable = (node) =>
    node.type == 'VariableDeclarator'

  const gives = new Set
  const takes = new Set

  const ast = esprima.parseScript(code, {range: true}, function (node, meta) {
    if (declaresVariable(node)) {
      gives.add(node.id.name)
    }


    if(node.type == 'AssignmentExpression' && node.operator == '=') {
      if(node.left.type == 'Identifier') {
        gives.add(node.left.name)
      }

      if(node.right.type == 'Identifier') {
        if(!gives.has(node.right.name))
        takes.add(node.right.name)
      }

    }

    if(node.type == 'BinaryExpression') {
      if(node.left.type == 'Identifier') {
        if(!gives.has(node.left.name))
        takes.add(node.left.name)
      }

      if(node.right.type == 'Identifier') {
        if(!gives.has(node.right.name))
        takes.add(node.right.name)
      }
    }

    if(node.type == 'CallExpression') {

      const found = traverse(
        [node.callee],
        n => n.object,
        n => n.type == "Identifier"
      )

      if(found && !gives.has(found.name)) takes.add(found.name)
    }

  })

  console.log(ast)


  // shallow look for where we could inject extra return
  let last_expression_index = 0

  ast.body.forEach(node => {
    if(node.type == 'ExpressionStatement') {
      last_expression_index = node.range[0]
    }
  })



  return {
    gives: Array.from(gives),
    takes: Array.from(takes),
    '_': last_expression_index,
  }

}

export default parse
