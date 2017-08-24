
export class CancelablePromiseChain {

  constructor(init) {
    this.cancelled = false
    this.chain = Promise.resolve(init)
  }

  cancel() {
    this.cancelled = true
  }

  add(fn) {
    this.chain =
    this.chain.then(value => this.cancelled || fn(value))
  }

}
