const ENDPOINT = "https://api.cojs.co/v0"
// const ENDPOINT = 'http://localhost:3000'

import FrameStore from './FrameStore'

const STATES = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  DENIED: 2
}


// Maybe "Connection" might be better
class Session {

  constructor(id) {
    this.state = 'DISCONNECTED'

    // a localstore that can't be accessed by blob urls
    this.frameStorage = new FrameStore(ENDPOINT)

    this.id = id

    this.cached = null

    this.ready = Promise.resolve(id)

    if(!id)
      this.ready = this.create()
      .then(({session, token}) => {
        this.id = session
        this.token = token

        this.state = 'CONNECTED'

        return this.frameStorage.setItem(`auth-${session}`, token)
          .then(() => this.id)

      })
    else {
      this.ready = this.frameStorage.getItem(`auth-${id}`)
        .then(token => {
          if(token) {
            this.token = token
            this.state = 'CONNECTED'
            return this.id
          } else {
            this.state = 'DENIED'
            return null
          }
        })
    }
  }

  create() {
    return fetch(`${ENDPOINT}/session`,
      { method: "POST" }
    )
    .then(res => res.json())
  }


  set(ref, code) {
    if(this.state == 'DENIED')
      return Promise.reject('unauthorised')


    return this.ready.then(() => fetch(`${ENDPOINT}/cells/${this.id}/${ref}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        method: "POST",
        body: code
      })
    )
    .then(res => res.status == 200 ? res : res.json().then(Promise.reject.bind(Promise)))
    .then(res => res.json())

  }

  // an upstream set (updates cache)
  upset(ref, code) {
    this.cached[ref] = {ref, code}
  }

  delete(ref) {
    if(this.state == 'DENIED')
      return Promise.reject('unauthorised')


    return this.ready.then(() => fetch(`${ENDPOINT}/cells/${this.id}/${ref}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        method: "DELETE",
        body: ''
      })
    )
    .then(res => res.status == 200 ? res : res.json().then(Promise.reject.bind(Promise)))
    .then(res => res.json())

  }

  fetch() {
    return this.ready.then(() => fetch(`${ENDPOINT}/cells/${this.id}`,
      {
        method: "GET"
      })
      .then(res => res.json())
      .then(json => this.cached = json)
    )
  }

}

export default Session
