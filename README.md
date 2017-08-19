# cojs
cojs.co next


## Deploying

1. Sink several hours into getting AWS set up
2. `serverless deploy` (backend)
3. `gulp publish` (frontend)


## dev backend

```
serverless dynamodb install
serverless offline start
serverless dynamodb migrate (this imports schema)
```
