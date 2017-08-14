
const nodes = new Map

const add = (ref, source, inputs, outputs) =>
  nodes.set(ref, {source, inputs, outputs})


add(1, 'a = Math.random()', ['Math'], ['a'])
add(2, 'b = a * 2', ['a'], ['b'])
add(3, 'c = 42', [], ['c'])
add(4, 'd = c * 2', ['c'], ['d'])
// add(5, 'e = a * b * c * d', ['a','b','c','d'], ['e'])

console.log(nodes)



// compute graph edges
const edges = (nodes) => {

  // for each node, compute any other nodes it feeds into
  const edges = new Set

  nodes.forEach(({outputs}, ref) => {
    nodes.forEach(({inputs}, ref2) => {
      if(ref != ref2) {
        const linked = !outputs.every(output =>
          inputs.indexOf(output) == -1
        )

        if(linked) {
          edges.add([ref, ref2])
        }
      }
    })
  })

  return edges
}


console.log(edges(nodes))



/* option 1 */

const r1 = () => {
  let a
  const fn = () => {

    a = Math.random()

    console.log(`a is ${a}`)

    return {a}
  }
  return fn()
}

const r2 = ({a}) => {

  b = a * 2

  console.log(`b is ${b}`)

  return [b]
}



// This is how we could call it (though memoizes)
// r2(r1())
// r3(r4())

// console.log("---", a)



const r1b = (state) => {

  let a

  Promise.all([])
    .then(() => {

      a = Math.random()

    })
    .then(() => {
      return Object.assign(state, {a})
    })
}


const r2b = (state) => {

  let b

  Promise.all([state.a])
    .then(([a]) => {

      b = a * 2

    })
    .then(() => {
      return Object.assign(state, {b})
    })
}


// b += 2


const r2c = (a, b) => {
  new Function('b = a * 2')()
  return [b]
}
