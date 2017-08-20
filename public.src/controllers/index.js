import Cell from '../Cell'

class Controller {

  constructor() {
    this.cells = [new Cell({ref: 0})]
    this.listeners = []
    this.handle()
  }

  set(ref, code) {

    if(!this.cells[ref]) this.cells[ref] = new Cell

    this.cells[ref].setCode(code)

    this.handle()
    // this.fire('change', this.cells)
  }

  add() {
    const ref = this.cells.length
    this.cells = this.cells.concat(new Cell({ref}))

    this.handle()
    this.fire('added', this.cells)
  }

  rm(ref) {
    console.log("todo")
  }

  handle() {
    console.error(`handler not implemented for ${this}`)
  }

  on(event, listener) {
    this.listeners.push([event, listener])
  }
  fire(event, payload) {
    this.listeners.forEach(([_event, listener]) => {
      if(event === _event) {
        listener(payload)
      }
    })
  }

}


// This does basic evaluation without shared state
class BasicController extends Controller {
  constructor() {
    super()
  }

  handle() {
    console.log("handle change", this.cells)

    this.cells.forEach(cell => {
      if(cell.dirtyParse) {
        cell.analyse()
        cell.evaluate()
      }
    })
  }
}


export {
  BasicController
}
