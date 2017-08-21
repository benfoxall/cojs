import evaluate from './evaluate'
import parse from './parse'
import render from './render'
import Session from './Session'
import {BasicController} from './controllers'
import iframeEvaluator from './iframeEvaluator'


const s = document.currentScript
if(s && s.hasAttribute('data-render')) {

  const controller = new BasicController

  render(document.body, controller)
}

export {evaluate, parse, render, Session, BasicController, iframeEvaluator}
