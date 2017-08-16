
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

}

export default Cell
