import App from './ui/App.html'
import Cell from './Cell'

const render = node => {

  const app = new App({
    target: node,
    data: {cells: []}
  })

  const cells = []

  window.cells = cells

  cells.push(new Cell)
  cells.push(new Cell)

  cells[0].setCode(`const a = 123
const b = 12
const c = 1245

x = a + b + c`)

  app.set({
    cells: cells
  })

}


export default render
