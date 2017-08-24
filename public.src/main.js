import evaluate from './evaluate'
import parse from './parse'
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

export {evaluate, parse, parseRecast, render, Session, iframeEvaluator}
