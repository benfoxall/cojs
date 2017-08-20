import App from './ui/App.html'
// import Cell from './Cell'
import remoteStore from './remoteStore'

const render = (node, controller) => {

  const app = new App({
    target: node,
    data: {cells: []}
  })

  // update the cells from the state
  app.set({cells: controller.cells})

  // a new cell was added
  controller.on('added', cells => {
    app.set({cells: cells})
  })

  // connect the state to remote
  // const store = remoteStore()
  // store.on('cell', (cell) => {state.put(cell, true)})

  // state.on('cell', (cell) => {store.put(cell, true)})


  app.on('add', () => { controller.add() })

  app.on('update', (cell) => {
    controller.set(cell.ref, cell.code)
  })



}


export default render
