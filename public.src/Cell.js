
class Cell {

  constructor() {
    this.code = ''

    this.dirtyParse = false
    this.dirtyEval = false

    this.gives = []
    this.takes = []
    this.point = 0

    this.result = undefined
    this.state = {}
  }

  setCode(code) {
    if(this.code != code) {
      this.dirtyParse = this.dirtyEval = true
    }

    this.code = code
  }

  analyse() {
    const result = parse(this.code)

    // todo gives & takes

    this.point = result._
    this.dirtyParse = false
  }

  evaluate() {
    if(this.dirtyParse)
      return console.error("won't evaluate: dirty parse")

    const instrumented =
      this.code.slice(0, this.point)
       + ';const ___=' +
      this.code.slice(this.point)

    const evaluated = evaluate(instrumented, {}, ['___'], [])
  }

}

export default Cell
