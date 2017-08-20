import App from './ui/App.html'
// import Cell from './Cell'
import remoteStore from './remoteStore'

const render = (node, state) => {

  const app = new App({
    target: node,
    data: {cells: [{
      ref: 0,
      code: '',
      output: ''
    }]}
  })

  // update the cells from the state
  const cells = []

  state.on('cell', (cell) => {
    cells[cell.ref] = cell
    app.set({cells})
  })


  // connect the state to remote
  const store = remoteStore()
  store.on('cell', (cell) => {state.put(cell, true)})

  // state.on('cell', (cell) => {store.put(cell, true)})


  app.on('add', () => { state.add() })

  app.on('update', (cell) => {
    state.put(cell)
    console.log("update", cell)
  })



}


export default render
