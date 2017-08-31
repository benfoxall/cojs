import loopProtect from 'loop-protect'
window.protect = loopProtect.protect

import _debug from 'debug'
const debug = _debug('iframe-eval')


let frame_id = 0


class iframeEvaluator {

  constructor(iframe) {
    this.iframe = iframe
    this.id = frame_id++

    this.callback_id = 0
    this.callbacks = new Map

    this.iframe.sandbox = 'allow-scripts allow-same-origin'

    window.addEventListener('message', this)
  }

  handleEvent(e) {
    const {data} = e

    if(this.id == data.frame_id) {
      if(data.type == 'resize') {

        this.iframe.style.height = '1px'
        const h = this.iframe.contentWindow.document.body.scrollHeight
        this.iframe.style.height = (h + 20 + 'px')
      }
      if(data.type == 'callback') {
        const fn = this.callbacks.get(data.callback_id)
        if(fn){
          fn(data.value)
          this.callbacks.delete(data.callback_id)
        }
      }
    }
  }

  // Hello! Welcome to this part of the code!!
  //
  // Yep, this is a function, that generates a function
  // that generates a string that evaluates to a function
  // which, when called will trigger the event handler
  // above which will in turn resolve the promise also
  // returned by the original function
  //
  // If you're interested, I will totally tell you about it
  // over a beer/wine/cocktail (you're buying, because I
  // just wrote this)
  //
  generateCallback(timeout = 1000) {
    const callback_id = this.callback_id++

    const srcGen = (value = '""') => `
      ;window.parent.postMessage({
        frame_id: ${this.id},
        callback_id: ${callback_id},
        type: 'callback',
        value: ${value}
      }, '*');
    `
    const promise = new Promise((resolve,reject) => {
      this.callbacks.set(callback_id, resolve)
      setTimeout(reject, timeout)
    })

    return [srcGen, promise]
  }

  // display an error in the iframe
  displayError(htm) {
    const src = `
      <html><head>
      <style>
      body {
        font-family:'Roboto Mono', monospace;
        margin:0;
      }
      #error {
        padding: 1.3em;
        color: #c00;
        font-size: 0.8em
      }
      </style>
      </head>
      <body>
        <div id="error">${htm}</div>
        <script>
          window.parent.postMessage({
            frame_id: ${this.id},
            type: 'resize'
          }, '*')
        </script>
      </body>
      </html>`

    const blob = new Blob([src], {type: 'text/html'})
    const url = URL.createObjectURL(blob)

    if(this.iframe.src) URL.revokeObjectURL(this.iframe.src)

    this.iframe.src = url
  }

  evaluate(code, returns, state = {}) {

    debug(`executing: \n${code}`)
    debug(`returns: \n${returns}`)

    const callback_id = this.callback_id++

    const processed = loopProtect.rewriteLoops(code)

    window.state = state

    const keys = Object.keys(state)
      .filter(k => returns.indexOf(k) == -1 )
      .filter(k => k != '___')


    const [_error, error] = this.generateCallback(500)
    const [_ready, ready] = this.generateCallback(500)

    const src = `
      <html><head>
      <style>
      body {
        font-family:'Roboto Mono', monospace;
        margin:0;
      }
      body > * {
        max-width: 100%;
        max-height: 100%;
      }
      #output {
        padding: 1.3em;
      }
      </style>
      </head><body>
        <script>
          window.runnerWindow = window.parent

          window.onerror = (err) => {
            ${_error('err')}
          }

          ${keys.map(k =>
            `const ${k} = window.parent.state.${k};`
          ).join(' ')}

          let __VALUE
          const __R = (v) => __VALUE = v
        </script>
        <script>
          ${processed}
        </script>
        <script>
          window.returns = {${returns.join(', ')}}

          ${_ready()}

          if(__VALUE) {
            const div = document.createElement('div')
            div.id = 'output'
            div.innerText = __VALUE

            if(__VALUE.toString() == '[object Object]') {
              div.innerText = JSON.stringify(__VALUE, null, 5)
            }

            if (typeof __VALUE == 'function') {
              div.innerText = 'Function'
            }
            if(__VALUE instanceof HTMLElement) {
              document.body.appendChild(__VALUE)

              if(__VALUE instanceof HTMLImageElement) {
                __VALUE.addEventListener('load', () => {
                  window.parent.postMessage({
                    frame_id: ${this.id},
                    type: 'resize'
                  }, '*')
                })
              }

            } else {
              document.body.appendChild(div)
            }

          }

          window.parent.postMessage({
            frame_id: ${this.id},
            type: 'resize'
          }, '*')

        </script>
      </body></html>
    `

    const blob = new Blob([src], {type: 'text/html'})
    const url = URL.createObjectURL(blob)

    if(this.iframe.src) URL.revokeObjectURL(this.iframe.src)

    this.iframe.src = url

    return new Promise((resolve, reject) => {
      ready.then(
        () => {
          const result = this.iframe.contentWindow.returns
          debug(`output: ${Object.keys(result)}`)
          resolve(result)
        }
      ).catch(reject)

      error.then(e => {
        this.displayError(e.toString());
        return e
      })
      .then(reject)
      .catch(() => {})
    })
    return response

  }

}


export default iframeEvaluator
