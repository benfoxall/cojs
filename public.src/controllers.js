import Cell from './Cell'

class Controller {

  constructor(
    this.cells = []
  )

  set(ref, code) {

    if(!this.cells[ref])
      this.cells[ref] = new Cell

    this.cells[ref].setCode(code)

    this.handle()
  }

  rm(ref) {
    console.log("todo")
  }

  handle() {
    console.error(`handler not implemented for ${this}`)
  }

}


// This does basic evaluation without shared state
class BasicController extends Controller {
  constructor() {
    this.super()
  }

  handle() {
    console.log("handle change")
  }
}


export {
  BasicController
}
