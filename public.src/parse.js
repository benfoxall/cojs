
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

  const ast = esprima.parseScript(code, {}, function (node, meta) {
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

  return {
    gives: Array.from(gives),
    takes: Array.from(takes)
  }

}

export default parse
