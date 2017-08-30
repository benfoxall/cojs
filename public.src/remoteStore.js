import Connection from './Session'

const getQueryString = () =>
  (document.location.search || '').replace('?', '')

const setQueryString = (qs) =>
  window.history.pushState({}, null, '/?' + qs)

const getQueryStringParts = () =>
  getQueryString().split('|')

const setQueryStringParts = (parts) =>
  setQueryString(parts.join('|'))



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

  // const qs = getQueryString()

  const qsp = getQueryStringParts()

  let connection

  if(qsp.length == 1) {

    connection = new Connection(qsp[0])

    if(!qsp[0]) connection.ready.then(id => {
      setQueryStringParts([id])
    })

    connection
      .fetch()
      .then(items => {
        items.forEach(item => {
          fire('cell', item)
        })
      })


  } else if(qsp.length == 2) {

    console.log("WE HAVE A FORK")
    // fork
    const backing = new Connection(qsp[0])

    connection = new Connection(qsp[1])

    if(!qsp[1]) {
      connection.ready.then(id => {
        qsp[1] = id
        setQueryStringParts(qsp)
      })
    }

    // reduce to an object keyed by ref
    const to_o = arr =>
      arr.reduce((o, item) => {
        o[item.ref] = item;
        return o
      }, {})

    Promise.all([
      backing.fetch(),
      connection.fetch()
    ])
    .then(([source, actual]) => {
      const data = Object.assign(
        to_o(source),
        to_o(actual)
      )

      Object.keys(data)
        .forEach(k => {
          fire('cell', data[k])
        })
    })

  }


  // TODO - handle invalid tokens
  const debounces = new Map
  const put = (cell) => {
    clearTimeout(debounces.get(cell.ref))
    debounces.set(cell.ref, setTimeout(() => {
      connection.set(cell.ref, cell.code)
      .catch(e => {
        console.log(`didn't save ${cell.ref} - ${e}`)
      })

    }, 1000))
  }


  return { on, put, connection }

}

export default remoteStore
