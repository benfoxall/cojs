import App from './App.html'

const render = node => {

  const app = new App({
    target: node
  });

  app.set({ name: 'everybody' });

}


export default render
