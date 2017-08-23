import Cell from '../Cell'
import throttle from 'lodash.throttle'

import _debug from 'debug'
const debug = _debug('contoller')

// import {throttle} from 'lodash-es' (takes over a second!!)


class Controller {

  constructor() {
    this.cells = []
    this.listeners = []
    this.handle()
  }

  set(ref, code) {

    if(!this.cells[ref]) {
      this.cells[ref] = new Cell({ref, code})
      this.fire('added', this.cells)
    }
    else this.cells[ref].setCode(code)

    this.handle()
    this.fire('cell-updated', this.cells[ref])
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

// A shared state controller
class StateController extends Controller {
  constructor() {
    super()
    this.state = {}

    this.last = Promise.resolve()
  }

  queue(pgen) {
    this.last = this.last
      .then(() => pgen())
      .catch(e => console.log("error in queue:", e))
  }

  handle() {
    this.cells.forEach(cell => {
      if(cell.dirtyParse) {
        cell.analyse()
        this.queue(() =>
          cell.evaluate(this.state)
            .then(result => {
              Object.assign(this.state, result)
            })
            .catch((e) => {
              cell.gives.forEach(k => this.state[k] = undefined)
            })
        )
      }
    })
  }
}

// run through the full list of cells
class SequenceController extends Controller {
  constructor() {
    super()
    this.state = {}

    this.last = Promise.resolve()

    this.handle = throttle(this.handle.bind(this), 600)
  }

  handle() {
    debug("handle")

    const any_dirty = !this.cells.every(cell =>
      !cell.dirtyParse
    )

    if(any_dirty) {
      // pass the state through the chain
      let state = Promise.resolve({})

      this.cells.forEach(cell => {

        if(cell.dirtyParse) cell.analyse()

        state = state.then((state) =>
          cell.evaluate(state)
            .then(result =>
              Object.assign({}, state, result)
            )
            .catch((e) => {
              const blank = cell.gives.reduce((memo, k) => {
                memo[k] = undefined
                return memo
              }, {})
              
              return Object.assign({}, state, blank)
            })
        )
      })

    }
  }
}





export {
  BasicController,
  StateController,
  SequenceController
}
