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
  const store = remoteStore()
  store.on('cell', (cell) => {
    controller.set(cell.ref, cell.code, true)
  })

  controller.on('cell-updated', (cell, upstream, ok) => {
    if(!upstream)
      store.put(cell)
  })

  // setTimeout(() => {

  console.log("STATE", store.connection.state)
  if(store.connection.state == 'DENIED') {
    app.set({
      has_access: false,
      session_id: store.connection.id
    })
  }

  // }, 10)

  // TODO - handle access/forking


  app.on('add', () => { controller.add() })

  app.on('update', (cell) => {
    controller.set(cell.ref, cell.code)
  })



}


export default render
