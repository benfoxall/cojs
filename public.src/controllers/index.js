import Cell from '../Cell'
import throttle from 'lodash.throttle'
// import {throttle} from 'lodash-es' (takes over a second!!)

import {CancelablePromiseChain} from '../util'

import _debug from 'debug'
const debug = _debug('contoller')


class Controller {

  constructor() {
    this.cells = []
    this.listeners = []
    this.handle()
  }

  set(ref, code, isUpstream, upstreamValue) {

    if(!this.cells[ref]) {
      this.cells[ref] = new Cell({
        ref, code, isUpstream, upstreamValue
      })
      this.fire('added', this.cells)
    }
    else this.cells[ref].setCode(code)

    this.handle()
    this.fire('cell-updated', this.cells[ref], isUpstream)
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
  fire(event, ...payload) {
    this.listeners.forEach(([_event, listener]) => {
      if(event === _event) {
        listener.apply(listener, payload)
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


class SequenceCacheController extends Controller {
  constructor() {
    super()
    this.handle = throttle(this.handle.bind(this), 10)
    this.resultCache = new Map
  }

  handle() {
    debug(`handle ${this.cells.length}`)

    const any_dirty = !this.cells.every(cell =>
      !cell.dirtyParse
    )


    if(any_dirty) {

      if(this.chain) {
        debug("cancelling previous chain")
        this.chain.cancel()
      }

      this.chain = new CancelablePromiseChain({})

      let found
      this.cells.forEach(cell => {

        if(cell.dirtyParse) {
          found = true

          cell.analyse()
        }

        if(!found && this.resultCache.has(cell)){
          debug("skip", this.resultCache.get(cell))
          this.chain.add((s) =>
            Object.assign({}, s, this.resultCache.get(cell))
          )

          return
        }

        this.chain.add((state) => {
          return cell.evaluate(state)
            .catch((e) => {
              return cell.gives.reduce((memo, k) => {
                memo[k] = undefined
                return memo
              }, {})
            })
            .then(result => {
              this.resultCache.set(cell, result)
              return Object.assign({}, state, result)
            })
        })

      })

    }
  }
}




class GraphController extends Controller {
  constructor() {
    super()
    this.handle = throttle(this.handle.bind(this), 10)
    this.resultCache = new Map
  }

  handle() {
    debug(`handle ${this.cells.length}`)

    // pre-evaluate all cells
    this.cells.forEach(cell => {
      if(cell.dirtyParse) cell.analyse()
    })

    // construct a call graph
    const edges = []

    this.cells.forEach(a => {
      this.cells.forEach(b => {
        if(a === b) return

        const connected = !a.gives.every(g =>
          !b.takes.includes(g)
        )

        if(connected)
          edges.push([a, b])
      })
    })

    debug(`edges`, edges)


    // invalidate forward
    const invalidations = this.cells.filter(cell => cell.dirtyEval)

    const expand = cell =>
      edges
        .filter(([from]) => from === cell)
        .map(([from, to]) => to)



    for(let i = 0; i < invalidations.length; i++) {
      const cell = invalidations[i]
      expand(cell)
        .forEach(expansion => {
          if(invalidations.indexOf(expansion) === -1) {
            invalidations.push(expansion)
            debug("invalidation expansion", expansion.ref)
          }
        })
    }

    debug(invalidations.map(c => c.ref))

    window.cells = this.cells

    if(this.chain) {
      debug("cancelling previous chain")
      this.chain.cancel()
    }
    this.chain = new CancelablePromiseChain({})

    this.cells.forEach(cell => {

      if(invalidations.indexOf(cell) === -1 &&
         this.resultCache.has(cell)
      ) {
         debug("skip", this.resultCache.get(cell))
         this.chain.add((s) =>
           Object.assign({}, s, this.resultCache.get(cell))
         )
         return
      }

      this.chain.add((state) => {
        return cell.evaluate(state)
          .catch((e) => {
            return cell.gives.reduce((memo, k) => {
              memo[k] = undefined
              return memo
            }, {})
          })
          .then(result => {
            this.resultCache.set(cell, result)
            return Object.assign({}, state, result)
          })
      })
    })
  }
}



export {
  BasicController,
  StateController,
  SequenceController,
  SequenceCacheController,
  GraphController
}
