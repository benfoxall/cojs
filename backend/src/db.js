'use strict';

const AWS = require('aws-sdk')

const options = {}
if (process.env.IS_OFFLINE) {
  Object.assign(options, {
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  })
}

const db = new AWS.DynamoDB.DocumentClient(options);


const generateProcessId = () => {

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      session: '00-process-counter',
      ref: 0
    },
    ExpressionAttributeNames: {
      '#count': 'count',
    },
    ExpressionAttributeValues: {
      ':number': 1,
    },
    UpdateExpression: 'ADD #count :number',
    ReturnValues: 'ALL_NEW',
  }

  return new Promise((resolve, reject) => {
    db.update(params, (error, updated) => {

      if (error) {
        console.error(error);
        reject(new Error('Couldn\'t create item.'));
        return;
      }

      resolve(updated.Attributes.count)
    })
  })
}

module.exports = {
  db,
  generateProcessId
}
