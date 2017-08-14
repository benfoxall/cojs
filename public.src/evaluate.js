const evaluate = (code, state = {}, takes = [], gives = []) => {

  let a
  eval(code)

  return {a: a}

}

export default evaluate
