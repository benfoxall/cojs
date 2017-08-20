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
        fire('cell', item)
      })
    })


  return { on }

}

export default remoteStore
