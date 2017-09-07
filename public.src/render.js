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
  store.on('cell', (cell, upstream, upstreamValue) => {
    controller.set(cell.ref, cell.code, upstream, upstreamValue)
  })


  controller.on('cell-updated', (cell, upstream, deleted) => {
    if(!upstream) {
      if(deleted) {
        store.rm(cell)
      } else {
        store.put(cell)
      }
    }
  })


  // console.log("STATE", store.connection.state)
  if(store.connection.state == 'DENIED') {
    app.set({
      has_access: false,
      session_id: store.connection.id
    })
  }


  app.on('add', () => { controller.add() })

  app.on('update', (cell) => {
    controller.set(cell.ref, cell.code, null, null, cell.deleted)
  })

  store.on('upstream-update', (s_id, ref) => {
    // get the relevent cell

    controller.cells.filter(cell => {
      if(cell.ref == ref) {
        cell.handleUpstreamChange(store)
      }
    })

  })


  // hooks for external ui
  return {
    set: (ref, code) => {
      console.log("attempting set", {ref, code})
      controller.setForce(ref, code, false, null)
    }
  }

}


export default render
