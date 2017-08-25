const ENDPOINT = "https://api.cojs.co/v0"
// const ENDPOINT = 'http://localhost:3000'

const STATES = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  DENIED: 2
}


// Maybe "Connection" might be better
class Session {

  constructor(id) {
    this.state = 'DISCONNECTED'

    this.id = id

    this.ready = Promise.resolve(id)

    if(!id)
      this.ready = this.create()
      .then(({session, token}) => {
        this.id = session
        this.token = token

        localStorage.setItem(`auth-${session}`, token)

        this.state = 'CONNECTED'

        return this.id
      })
    else {
      this.token = localStorage.getItem(`auth-${id}`)

      if(!this.token) {
        this.state = 'DENIED'
      } else {
        // todo validate first
        this.state = 'CONNECTED'
      }
    }
  }

  create() {
    return fetch(`${ENDPOINT}/session`,
      { method: "POST" }
    )
    .then(res => res.json())
  }


  set(ref, code) {
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

  fetch() {
    return this.ready.then(() => fetch(`${ENDPOINT}/cells/${this.id}`,
      {
        method: "GET"
      })
      .then(res => res.json())
    )
  }

}

export default Session
