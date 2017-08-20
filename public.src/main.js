import evaluate from './evaluate'
import parse from './parse'
import render from './render'
import Session from './Session'


const s = document.currentScript
if(s && s.hasAttribute('data-render'))
  render(document.body)


const session = new Session()

window.s = session

Promise.all([
  session.set(
    3, 'hello world!!!! LAST'
  ),
  session.set(
    0, 'hello world'
  ),
  session.set(
    1, 'hello world!!!! NO NO NO'
  )
])
.then(() => {
  console.log("done")

  session.fetch().then(items => {
    console.table(items)
  })
})

console.log(session)


export {evaluate, parse, render, Session}
