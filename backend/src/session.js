const {db, generateProcessId} = require('./db')
const jwt = require('jsonwebtoken')

const Hashids = require('hashids')
var hashids = new Hashids('', 0, 'abcdefghjkmnpqrstuvwxyz23456789')

const processId = generateProcessId()

processId.then(id => console.log(`ProcessId: ${id}`))

let count = 0

module.exports.create = (event, context, callback) => {
  processId
    .then(id => {

      // create a session id
      const session = hashids.encode(id, count++)

      // generate a token for 1 day
      const token = jwt.sign(
        { session },
        process.env.JWT_SECRET,
        {expiresIn: '1d'}
      )

      const response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin" : "*"
        },
        body: JSON.stringify({
          session: session,
          token: token
        })
      };
      callback(null, response);

    })
}


const Pusher = require('pusher');

var pusher = new Pusher({
  appId: process.env.pusher_app_id,
  key: process.env.pusher_key,
  secret: process.env.pusher_secret,
  cluster: process.env.pusher_cluster,
  encrypted: true
});

const forbidden = (error, callback) => {
  const {name, message} = error
  callback(null, {
    statusCode: 403,
    headers: {
      "Access-Control-Allow-Origin" : "*"
    },
    body: JSON.stringify({name, message})
  })
}

module.exports.update = (event, context, callback) => {

  const auth = event.headers.Authorization || ''
  const [_bearer, token] = auth.split(' ')

  const {session, ref} = event.pathParameters



  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

    if(err)
      forbidden(err, callback)


    if(decoded.session != session)
      forbidden({
        name: 'TokenMismatchError',
        message: `session ${decoded.session} does not match`
      }, callback)



    // TODO - handle bad data & validation

    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        session: `a-${session}`,
        ref: parseInt(ref, 10)
      },
      ExpressionAttributeNames: {
        '#code': 'code',
      },
      ExpressionAttributeValues: {
        ':code': event.body,
      },
      UpdateExpression: 'SET #code = :code',
      ReturnValues: 'ALL_NEW',
    }

    // return new Promise((resolve, reject) => {
    db.update(params, (error, updated) => {

      if (error) {
        console.error(error);
        callback(new Error('Couldn\'t update item.'));
        return;
      }

      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin" : "*"
        },
        body: JSON.stringify(updated)
      })

      pusher.trigger(session, 'update', {
        ref: parseInt(ref, 10),
        code: event.body
      })
    })

  })



}



module.exports.delete = (event, context, callback) => {

  const auth = event.headers.Authorization || ''
  const [_bearer, token] = auth.split(' ')

  const {session, ref} = event.pathParameters


  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

    if(err)
      forbidden(err, callback)


    if(decoded.session != session)
      forbidden({
        name: 'TokenMismatchError',
        message: `session ${decoded.session} does not match`
      }, callback)



    // TODO - handle bad data & validation

    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        session: `a-${session}`,
        ref: parseInt(ref, 10)
      }
    }

    // return new Promise((resolve, reject) => {
    db.delete(params, (error) => {

      if (error) {
        console.error(error);
        callback(new Error('Couldn\'t delete item.'));
        return;
      }

      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin" : "*"
        },
        body: JSON.stringify({deleted: true, session, ref})
      })

      pusher.trigger(session, 'delete', {
        ref: parseInt(ref, 10)
      })
    })

  })
}



module.exports.fetch = (event, context, callback) => {

  var params = {
    TableName: process.env.DYNAMODB_TABLE,
    KeyConditionExpression: "#session = :session",
    ExpressionAttributeNames:{
      "#session": "session"
    },
    ExpressionAttributeValues: {
      ":session": `a-${event.pathParameters.session}`
    }
  }

  db.query(params, function(err, data) {
    if (err) {
      console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
      callback(new Error("Unable to query"))

    } else {
      console.log("Query succeeded.");
      data.Items.forEach(function(item) {
        console.log(" -", item)
      })


      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin" : "*"
        },
        body: JSON.stringify(data.Items.map(({ref, code}) => ({ref, code})))
      })
    }

  })

}


const fs = require('fs')
const proxyHTM = new Promise(resolve =>
  fs.readFile(__dirname + '/proxy.html', 'utf8',
    (err, data) => resolve(data)
  )
)


module.exports.proxy = (event, context, callback) => {

  proxyHTM.then(htm => {

    // todo - long-life cache
    callback(null, {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: htm
    })

  })

}
