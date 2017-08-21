import loopProtect from 'loop-protect'
window.protect = loopProtect.protect


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
      if(data.type == 'height') {
        this.iframe.style.height = `calc(${data.value}px - 2em)`
      }
      if(data.type == 'callback') {
        const fn = this.callbacks.get(data.callback_id)
        if(fn){
          fn(data.value)
        }

      }
    }
  }

  evaluate(code, returns) {

    const callback_id = this.callback_id++

    const processed = loopProtect.rewriteLoops(code)

    const src = `
      <html><head>
      <style>
      body {
        font-family:'Roboto Mono', monospace;
        margin:0;
        padding:0
      }
      </style>
      </head><body>
        <script>
          window.runnerWindow = window.parent
        </script>
        <script>
          ${processed}
        </script>
        <script>
          window.returns = {${returns.join(', ')}}

          window.parent.postMessage({
            frame_id: ${this.id},
            callback_id: ${callback_id},
            type: 'callback',
          }, '*')

          window.parent.postMessage({
            frame_id: ${this.id},
            type: 'height',
            value: document.body.offsetHeight,
          }, '*')

        </script>
      </body></html>
    `

    const blob = new Blob([src], {type: 'text/html'})
    const url = URL.createObjectURL(blob)

    if(this.iframe.src) URL.revokeObjectURL(this.iframe.src)


    this.iframe.src = url

    const response = new Promise((resolve, reject) => {
      this.callbacks.set(callback_id, () => {
        resolve(this.iframe.contentWindow.returns)
      })
    })

    return response

  }

}


export default iframeEvaluator
