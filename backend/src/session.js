const {db, generateProcessId} = require('./db');


const processId = generateProcessId()

processId.then(id => console.log(`ProcessId: ${id}`))

let count = 0

module.exports.create = (event, context, callback) => {


  processId
    .then(id => {

      const response = {
        statusCode: 200,
        body: JSON.stringify([
          id, count++
        ])
      };
      callback(null, response);

    })

}
