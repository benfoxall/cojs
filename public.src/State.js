import Session from './Session'

/*
 handles the state of session & all cells

 - parse
 - evaluate
 - persist

 - subscriptions
*/


class State {

  constructor (session) {
    this.cells = [] // ref, code, output

    this.listeners = []
  }

  on(event, fn) {
    this.listeners.push([event, fn])
  }

  // load() {
  //   // syncronise with remote store
  //
  //   const queryString = (document.location.search || '').replace('?', '')
  //   const session = new Session(queryString)
  //
  //   session.ready.then(id => {
  //     if(window.history)
  //       window.history.pushState({}, null, '/?' + id)
  //     else if(!queryString)
  //       document.location = '?' + id
  //   })
  //
  //   session
  //     .fetch()
  //     .then(d => d.forEach(({ref, code})=> this.set(ref, code, true)))
  //
  // }

  set(ref, code, upstream) {

    if(this.cells[ref]) {
      this.cells[ref].code = code
      this.cells[ref].output = code + 'outpu'
    }

    this.viewers.forEach(fn => fn(this.cells))
  }

  add() {
    this.cells.push({
      ref: this.cells.length,
      code: '// code',
      output: '// output'
    })
    console.log(this.cells)

    this.viewers.forEach(fn => fn(this.cells))
  }

  parse() {

  }

  evaluate() {

  }


}


export default State
