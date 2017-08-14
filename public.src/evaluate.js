const evaluate = (code, state, gives, takes) => {

  const intrumented = `${code}; return {${gives.join(', ')}}`

  const args = takes.concat(intrumented)

  const fn = Function.apply(null, args)

  return fn.apply(null, takes.map(v => state[v]))

}

export default evaluate
