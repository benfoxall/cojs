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
  generateCallback(timeout = 1000, expando) {
    const callback_id = this.callback_id++

    const parent = expando ? `p_${expando}` : 'window.parent'

    const srcGen = (value = '""') => `
      ;${parent}.postMessage({
        frame_id: ${this.id},
        callback_id: ${callback_id},
        type: 'callback',
        value: ${value}
      }, '*');
    `
    const promise = new Promise((resolve,reject) => {
      this.callbacks.set(callback_id, resolve)
      // TODO (INCREDIBLY IMPORTANT): CANCEL THESE PROMISES
      //       ON REEVALUATION
      // setTimeout(reject, timeout)
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

    const expando = Math.random().toString(32).slice(2)

    debug(`executing: \n${code}`)
    debug(`returns: \n${returns}`)

    const callback_id = this.callback_id++

    loopProtect.method = `p_${expando}.protect`

    const processed = loopProtect.rewriteLoops(code)

    window.state = state

    const keys = Object.keys(state)
      .filter(k => returns.indexOf(k) == -1 )
      .filter(k => k != '___')


    const [_error, error] = this.generateCallback(1500, expando)
    const [_ready, ready] = this.generateCallback(1500, expando)

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
          // window.runnerWindow = window.parent

          const p_${expando} = window.parent

          window.parent = null

          window.onerror = (err) => {
            ${_error('err')}
          }

          ${keys.map(k =>
            `const ${k} = p_${expando}.state.${k};`
          ).join(' ')}

          let __VALUE
          const __R = (v) => __VALUE = v
        </script>
        <script>
          ${processed}
        </script>
        <script>
          run()
            .then(result => {
              window.returns = result;

              ${_ready()}


          function _print(obj) {
            const prev = document.getElementById('output')
            if(prev) prev.remove()

            const div = document.createElement('div')
            div.id = 'output'
            div.innerText = obj

            if(obj.toString() == '[object Object]') {
              div.innerText = JSON.stringify(obj, null, 5)
            }

            if (obj === null) {
              div.innerText = 'null'
            }

            if (typeof obj == 'function') {
              div.innerText = 'Function'
            }
            if(obj instanceof HTMLElement) {
              document.body.appendChild(obj)

              if(obj instanceof HTMLImageElement) {
                obj.addEventListener('load', () => {
                  p_${expando}.postMessage({
                    frame_id: ${this.id},
                    type: 'resize'
                  }, '*')
                })
              }

            } else {
              document.body.appendChild(div)
            }

            p_${expando}.postMessage({
              frame_id: ${this.id},
              type: 'resize'
            }, '*')
          }

          if(__VALUE) {

            if(__VALUE instanceof Promise) {
              _print('...')
              __VALUE.then(_print, _print)
            } else {
              _print(__VALUE)
            }
          } else if(__VALUE===null){
            _print('null')

          }

          p_${expando}.postMessage({
            frame_id: ${this.id},
            type: 'resize'
          }, '*')

        })


        </script>
      </body></html>
    `

    const blob = new Blob([src], {type: 'text/html'})
    const url = URL.createObjectURL(blob)

    if(this.iframe.src) URL.revokeObjectURL(this.iframe.src)

    debug('RUNNING FRAME %d', this.id)
    this.iframe.src = url

    return new Promise((resolve, reject) => {
      ready.then(
        () => {
          debug('RAN FRAME %d', this.id)

          const result = this.iframe.contentWindow.returns
          debug(`output: ${Object.keys(result)}`)
          resolve(result)
        }
      ).catch((err) => {
        debug('FRAME ERROR %d %o', this.id, err)
        reject(err)
      })

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
