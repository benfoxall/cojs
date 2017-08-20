import parse from './parse'
import evaluate from './evaluate'


class Cell {

  constructor(options) {
    this.code = ''
    this.ref = options.ref

    this.dirtyParse = false
    this.dirtyEval = false

    this.gives = []
    this.takes = []
    this.point = 0


    this.output = ''
    this.state = {}

    this.parseError = null

    if(options.code) {
      this.setCode(options.code)
    }
  }

  setCode(code) {
    if(this.code != code) {
      this.dirtyParse = this.dirtyEval = true
      this.parseError = null
    }

    this.code = code
  }

  analyse() {

    try {
      const result = parse(this.code)
      this.point = result._
    } catch (e) {
      this.parseError = e.description
      this.point = -1

      if(this.listeners) {
        this.listeners.forEach(fn => {
          fn(this.parseError)
        })
      }

    } finally {
      this.dirtyParse = false
    }



  }

  evaluate() {
    if(this.code.trim() == ''){
      if(this.listeners) {
        this.listeners.forEach(fn => {
          fn(null, '')
        })
      }
      return
    }

    if(this.dirtyParse)
      return console.error("won't evaluate: dirty parse")

    if(this.parseError)
      return console.error("won't evaluate: parse error")

    const instrumented =
      this.code.slice(0, this.point)
       + ';const ___=' +
      this.code.slice(this.point)

    console.log(instrumented)

    this.state = evaluate(instrumented, {}, ['___'], [])

    this.output = this.state.___

    console.log(this.state)

    if(this.listeners) {
      this.listeners.forEach(fn => {
        fn(null, this.output)
      })
    }

  }

  addOutputListener(fn) {
    (this.listeners = this.listeners || [])
    .push(fn)
  }

  // addCodeListener(fn) {
  //   (this.code_listeners = this.code_listeners || [])
  //   .push(fn)
  // }

}

export default Cell
