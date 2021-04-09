const express = require('express')
const app = express()
const port = 3000

const indexRouter = require('./routes/index')
const usersRouter = require('./routes/users')

// JSON parser
app.use(express.json())

app.use('/', indexRouter)
app.use('/users', usersRouter)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
