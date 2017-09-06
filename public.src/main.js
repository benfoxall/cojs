import evaluate from './evaluate'
import parseRecast from './parse-recast'
import render from './render'
import Session from './Session'
import iframeEvaluator from './iframeEvaluator'
import { GraphController } from './controllers'


const s = document.currentScript
if(s && s.hasAttribute('data-render')) {

  const controller = new GraphController

  render(document.body, controller)

  if(document.location.origin.match('//cojs.co')) {
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

    ga('create', 'UA-35774866-7', 'auto');
    ga('send', 'pageview');
  }


  if(window.parent !== window) {
    window.addEventListener('message', (e) => {
      // if there's no action, it's probably from an evalutation cell
      if(!e.data.action) return null

      if(e.data.action == 'config') {
        const value = e.data.value
        Object.assign(document.body.style, value.bodyStyle)
      }
    })
    window.parent.postMessage({action: 'ready'}, '*')

    // previous/next keys for presentations
    window.addEventListener('keydown', e => {
      if(['PageDown', 'PageUp'].indexOf(e.key) > -1) {
        window.parent.postMessage({action: 'key', value: e.key}, '*')
      }
    })
  }

}

export {evaluate, parseRecast, render, Session, iframeEvaluator}
