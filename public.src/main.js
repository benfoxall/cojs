import evaluate from './evaluate'
import parse from './parse'
import render from './render'


const s = document.currentScript
if(s && s.hasAttribute('data-render'))
  render(document.body)



export {evaluate, parse, render}
