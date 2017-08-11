const cells = [
  'a = Math.random()',
  'b = a * 2',
  'c = 42',
  'd = c * 2',
]


// generate requirements
// const requirements = generateRequirements(cells)
const requirements = [
  {needs: [], gives: ['a']},
  {needs: ['a'], gives: ['b']},
  {needs: [], gives: ['c']},
  {needs: ['c'], gives: ['d']}
]

// generate dependency graph
// const depends = generateDepends(requirements)
const depends = [
  [],
  [0],
  [],
  [2]
]


// evaluate({}, 'a = Math.random()', ['c']) == {c: .42}
// evaluate({}, 'c = 42', ['c']) == {c: 42}





console.log(cells)
console.log(depends)
console.log(requirements)
