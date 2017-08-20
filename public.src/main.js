import evaluate from './evaluate'
import parse from './parse'
import render from './render'
import Session from './Session'
import State from './State'


const s = document.currentScript
if(s && s.hasAttribute('data-render')) {
  render(document.body, new State())
}


export {evaluate, parse, render, Session}
