const {db, generateProcessId} = require('./db')
const jwt = require('jsonwebtoken')


const processId = generateProcessId()

processId.then(id => console.log(`ProcessId: ${id}`))

let count = 0

module.exports.create = (event, context, callback) => {
  processId
    .then(id => {

      // create a session id
      const session = [id, count++]

      // generate a token for 1 day
      const token = jwt.sign(
        { session },
        process.env.JWT_SECRET,
        {expiresIn: '1d'}
      )


      const response = {
        statusCode: 200,
        body: JSON.stringify({
          session: session,
          token: token
        })
      };
      callback(null, response);

    })
}
