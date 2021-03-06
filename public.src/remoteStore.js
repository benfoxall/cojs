import Connection from './Session'

import _debug from 'debug'
const debug = _debug('remote_store')

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
  const fire = (event, ...payload) => {
    listeners.forEach(([_event, fn]) => {
      if(_event == event) fn.apply(null, payload)
    })
  }

  // const qs = getQueryString()

  const qsp = getQueryStringParts()

  let connection
  let upstreams

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


  } else if(qsp.length > 1) {

    qsp.forEach((s, i, arr) => {
      if(arr.indexOf(s,i+1) != -1) {
        throw new Error(`Duplicate session key: ${s}`)
      }
    })


    const connections = qsp.map(s => new Connection(s))

    // the last one is the current session
    connection = connections[connections.length - 1]
    upstreams = connections.slice(0, -1)

    if(!connection.id) {
      connection.ready.then(id => {
        qsp[qsp.length - 1] = id
        setQueryStringParts(qsp)
      })
    }

    // reduce to an object keyed by ref
    const to_o = arr =>
      arr.reduce((o, item) => {
        o[item.ref] = item;
        return o
      }, {})

    Promise.all(
      connections.map(
        connection => connection.fetch()
          .then(to_o)
      )
    )
    .then((responses) => {
      const data = Object.assign.apply(Object, responses)

      const session = responses[responses.length - 1]

      Object.keys(data)
        .forEach(k => {

          // const up = getUpstream(k)

          // console.log("REVERTABE -- ", !session[k], !!getUpstream(k))
          fire('cell', data[k], !session[k], getUpstream(k))
        })


      // Live forking
      if(typeof Pusher != 'undefined') {
        debug("Connecting to upstreams")

        const socket = new Pusher('658119d533297d0ae6b1', {
          cluster: 'eu'
        })

        upstreams.forEach(up => {
          const channel = socket.subscribe(up.id)

          channel.bind('update', function (data) {
            // 1. update the session cache
            up.upset(data.ref, data.code)

            // 2. potentially update the ui
            fire('upstream-update', up.id, data.ref)
          })
        })
      }
    })




  }

  // (for falling back)
  // get the most recent upstream revision
  const getUpstream = ref => {
    let found
    upstreams.forEach(connection => {
      connection.cached.forEach(cell => {
        if(cell.ref == ref) found = cell
      })
    })
    return found
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

  const rm = (cell) => {
    clearTimeout(debounces.get(cell.ref))

    connection.delete(cell.ref)
    .then(c => {
      console.log("DELETED", cell.ref)
    })
    .catch(e => {
      console.log(`didn't delete ${cell.ref} - ${e}`)
    })
  }


  return { on, put, rm, connection, getUpstream }

}

export default remoteStore
