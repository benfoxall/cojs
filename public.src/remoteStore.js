import Connection from './Session'

const getQueryString = () => {
  return (document.location.search || '').replace('?', '')
}

const setQueryString = (qs) => {
  if(window.history)
    window.history.pushState({}, null, '/?' + qs)
  else
    document.location = '/?' + qs
}


const remoteStore = () => {

  const listeners = []
  const on = (event, fn) => {
    listeners.push([event, fn])
  }
  const fire = (event, payload) => {
    listeners.forEach(([_event, fn]) => {
      if(_event == event) fn(payload)
    })
  }

  const qs = getQueryString()
  const connection = new Connection(qs)

  if(!qs) connection.ready.then(setQueryString)

  // TODO - handle invalid tokens

  connection
    .fetch()
    .then(items => {
      items.forEach(item => {
        console.log("YES", item);
        fire('cell', item)
      })
    })

  const debounces = new Map
  const put = (cell) => {
    clearTimeout(debounces.get(cell.ref))
    debounces.set(cell.ref, setTimeout(() => {
      connection.set(cell.ref, cell.code)
    }, 1000))
  }


  return { on, put }

}

export default remoteStore
