import evaluate from './evaluate'
import parseRecast from './parse-recast'
import render from './render'
import Session from './Session'
import iframeEvaluator from './iframeEvaluator'
import {
  BasicController,
  StateController,
  SequenceController,
  SequenceCacheController,
  GraphController
} from './controllers'


const s = document.currentScript
if(s && s.hasAttribute('data-render')) {

  const controller = new GraphController

  render(document.body, controller)
}

export {evaluate, parseRecast, render, Session, iframeEvaluator}
