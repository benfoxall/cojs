import loopProtect from 'loop-protect'

loopProtect.method = '__protect';

const evaluate = (code, state, gives, takes) => {

  const processed = loopProtect.rewriteLoops(code)

  const intrumented = `${processed}; return {${gives.join(', ')}}`

  const args = takes.concat('__protect').concat(intrumented)

  const fn = Function.apply(null, args)

  return fn.apply(null, takes.map(v => state[v]).concat(loopProtect.protect))

}

export default evaluate
