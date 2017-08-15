const parse = (code) => {

  const declaresVariable = (node) =>
    node.type == 'VariableDeclarator'

  const identifiesVariable = (node) =>
    node.type == 'Identifier'

  const gives = new Set
  const takes = new Set

  esprima.parseScript(code, {}, function (node, meta) {
    if (declaresVariable(node)) {
      gives.add(node.id.name)

      if(takes.has(node.id.name)) {
        // console.log("reassigning takes as gives")
        takes.delete(node.id.name)
      }

    }

    if (node.type == 'Identifier') {
      console.log('takes', node.name)
      takes.add(node.name)
    }
  })

  return {
    gives: Array.from(gives),
    takes: Array.from(takes)
  }

}

export default parse
