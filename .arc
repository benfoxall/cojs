@app
cojs


@json

# create a new session
post /session

# create/update/view a cell
post /cell
post /cell/:id
get /cell/:id


@tables

cells
  id *String
  ref **String
