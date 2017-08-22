import parse from './parse'
import evaluate from './evaluate'
import iframeEvaluator from './iframeEvaluator'


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

    this.iframe = document.createElement('iframe')
    this.evaluator = new iframeEvaluator(this.iframe)

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

      this.gives = result.gives

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

  evaluate(state) {

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

    return this.evaluator.evaluate(
      instrumented,
      ['___'].concat(this.gives),
      state
    )

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
