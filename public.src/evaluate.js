import loopProtect from 'loop-protect'

window.runnerWindow = loopProtect

const evaluate = (code, state, gives, takes) => {
  const processed = loopProtect.rewriteLoops(code)

  const intrumented = `${processed}; return {${gives.join(', ')}}`

  const args = takes.concat(intrumented)

  const fn = Function.apply(null, args)

  return fn.apply(null, takes.map(v => state[v]))

}

export default evaluate
