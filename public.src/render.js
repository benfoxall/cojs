import App from './ui/App.html'

const render = node => {

  const app = new App({
    target: node,
    data: {cells: []}
  })

  app.set({
    cells: [
      `const a = 123
const b = 12
const c = 1245

const x = 123444`,
      `z = Math.random()`,
      '42'
    ].map(code => ({code}))
  })

}


export default render
