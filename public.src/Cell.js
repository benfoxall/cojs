import parseRecast from './parse-recast'
import evaluate from './evaluate'
import iframeEvaluator from './iframeEvaluator'


class Cell {

  constructor(options) {
    this.code = ''
    this.ref = options.ref

    this.dirtyParse = false
    this.dirtyEval = false
    this.parseError = null

    this.gives = []
    this.takes = []

    this.output = ''

    this.isUpstream = options.isUpstream
    this.hasUpstream = !!options.hasUpstream
    this.revertCode = options.hasUpstream && options.hasUpstream.code

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

      this.gives = []
      this.takes = []
    }
    this.code = code
  }


  revertListener(fn) {
    (this._revert_listeners = this._revert_listeners ||[])
      .push(fn)
  }

  handleUpstreamChange(store) {

    const shouldUpdate = this.code == this.revertCode

    const next = store.getUpstream(this.ref)
    this.revertCode = next.code

    if(shouldUpdate) {
      this._revert_listeners.forEach(fn => fn())
    }
  }

  analyse() {
    // this.gives = []
    // this.takes = []

    try {
      // const result = parseRecast(this.code)
      this.parseResult = parseRecast(this.code)

      this.dirtyParse = false
      this.gives = this.parseResult.gives
      this.takes = this.parseResult.takes

    } catch (e) {
      this.parseError = e.description

      this.evaluator.displayError(e.description || 'Error')

      // if(this.listeners) {
      //   this.listeners.forEach(fn => {
      //     fn(this.parseError)
      //   })
      // }

    } finally {
      this.dirtyParse = false
    }

  }

  evaluate(state) {

    // if(this.code.trim() == ''){
    //   // if(this.listeners) {
    //   //   this.listeners.forEach(fn => {
    //   //     fn(null, '')
    //   //   })
    //   // }
    //   return Promise.reject("empty")
    // }

    if(this.dirtyParse)
      return Promise.reject("won't evaluate: dirty parse")

    if(this.parseError)
      return Promise.reject("won't evaluate: parse error")

    const instrumented = this.parseResult.code

    return this.evaluator.evaluate(
      instrumented,
      this.gives,
      state
    ).then(r => {
      this.dirtyEval = false
      return r
    })

  }

  // addOutputListener(fn) {
  //   (this.listeners = this.listeners || [])
  //   .push(fn)
  // }

  // addCodeListener(fn) {
  //   (this.code_listeners = this.code_listeners || [])
  //   .push(fn)
  // }

}

export default Cell
