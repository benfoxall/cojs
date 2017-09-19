class Deffered {
  constructor() {
    this.promise = new Promise((resolve, reject) =>
      Object.assign(this, {resolve, reject})
    )
  }
}

// uses a proxy iframe for storage
// without leaking to blob urls
class FrameStore {
  constructor(endpoint = '') {
    this.frame = document.createElement('iframe')

    this.frame.src = `${endpoint}/proxy.html`

    this.frame.sandbox = 'allow-scripts allow-same-origin'
    this.frame.style.display = 'none'

    this.rpcID = 0
    this.rpcMap = new Map

    this.ready =
      new Promise(resolve => this._connected = resolve)
      .then((port) => {
        port.onmessage = e => {
          const {data} = e
          const dfr = this.rpcMap.get(data.id)
          if(dfr) {
            this.rpcMap.delete(data.id)

            const fn = data.status == 'RESOLVED' ?
              dfr.resolve :
              dfr.reject

            fn(data.value)
          }
        }
        return port
      })

    window.addEventListener('message', this)

    document.body.appendChild(this.frame)

  }

  handleEvent(e) {
    if(e.source === this.frame.contentWindow) {
      this.messagePort = e.ports[0]
      this.frame.contentWindow.postMessage(e.data, '*')

      window.removeEventListener('message', this)
      this._connected(e.ports[0])
    }
  }

  rpc(payload) {
    const id = this.rpcID++

    const reply = new Deffered()

    this.rpcMap.set(id, reply)

    this.ready
      .then(port => {
        port.postMessage({
          id,
          payload
        })
      })

    return reply.promise

  }

  getItem(key) {
    return this.rpc({
      action: 'GET',
      value: key
    })
  }

  setItem(key, value) {
    return this.rpc({
      action: 'SET',
      value: {
        key, value
      }
    })
  }
}

export default FrameStore
