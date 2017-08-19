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

module.exports.helloWorld = (event, context, callback) => {

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
  };

  db.update(params, (error, updated) => {
    // handle potential errors
    if (error) {
      console.error(error);
      callback(new Error('Couldn\'t create item.'));
      return;
    }

    const response = {
      statusCode: 200,
      body: updated.Attributes.count,
    };
    callback(null, response);
  });

};
