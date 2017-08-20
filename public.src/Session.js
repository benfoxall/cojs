// const ENDPOINT = "https://api.cojs.co/v0"
const ENDPOINT = 'http://localhost:3000'


// Maybe "Store" might be better
class Session {

  constructor(id) {
    // this.state = 'DISCONNECTED'
    this.id = id

    this.ready = Promise.resolve()

    if(!id)
      this.ready = this.create()
      .then(({session, token}) => {
        this.id = session
        this.token = token

        localStorage.setItem(`auth-${session}`, token)
      })
    else {
      this.token = localStorage.getItem(`auth-${id}`)
      // todo - handle no token & check token
    }
  }

  create() {
    return fetch(`${ENDPOINT}/session`,
      {
        method: "POST"
      })
      .then(res => res.json())
      .catch(function(res){ console.log(res) })
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
    ).then(res => res.json())
  }

  fetch() {
    return fetch(`${ENDPOINT}/cells/${this.id}`,
      {
        method: "GET"
      })
      .then(res => res.json())
  }

}

export default Session
