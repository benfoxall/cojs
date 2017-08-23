import evaluate from './evaluate'
import parse from './parse'
import render from './render'
import Session from './Session'
import iframeEvaluator from './iframeEvaluator'
import {
  BasicController,
  StateController,
  SequenceController
} from './controllers'


const s = document.currentScript
if(s && s.hasAttribute('data-render')) {

  const controller = new SequenceController

  render(document.body, controller)
}

export {evaluate, parse, render, Session, iframeEvaluator}
