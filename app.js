const express = require('express')
const app = express()
const path = require('path')
const sqlite = require('sqlite3')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
let db = null
app.use(express.json())
const bcrypt = require('bcrypt')
//initializong the server
const initializeDatabaseAndSERVER = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite.Database,
    })
  } catch (e) {
    console.log(e.message)
    process.exit(-1)
  }
  app.listen(3000, () => {
    console.log('SERVER STARTED')
  })
}
initializeDatabaseAndSERVER()
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await db.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
const coversion = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}
//API 2
app.get('/states/', authenticateToken, async (request, response) => {
  let {username} = request.params
  let result = await db.all(`SELECT * FROM state;`)
  let result2 = result.map(each => coversion(each))
  response.send(result2)
})
//API 3
app.get('/states/:stateId', authenticateToken, async (request, response) => {
  let {stateId} = request.params
  let result = await db.get(`SELECT * FROM state WHERE state_id=${stateId};`)
  response.send(coversion(result))
})
//API 4
app.post('/districts', authenticateToken, async (request, response) => {
  let {districtName, stateId, cases, cured, active, deaths} = request.body
  console.log(request.body)
  await db.run(
    `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`,
  )
  response.send('District Successfully Added')
})
//API 5
app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    let result = await db.get(
      `SELECT district_id AS districtId, district_name AS districtName,state_id AS stateId,cases,cured,active,deaths FROM district WHERE district_id=${districtId};`,
    )
    response.send(result)
  },
)
//API 6
app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    await db.run(`DELETE FROM district WHERE district_id=${districtId};`)
    response.send('District Removed')
  },
)
//API 7
app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    let {districtName, stateId, cases, cured, active, deaths} = request.body
    await db.run(
      `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId}`,
    )
    response.send('District Details Updated')
  },
)
//API 8
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    let {stateId} = request.params
    let result = await db.get(
      `SELECT SUM(district.cases) AS totalCases,SUM(district.cured) AS totalCured,SUM(district.active) AS totalActive,SUM(district.deaths) AS totalDeaths FROM district INNER JOIN state ON state.state_id=district.state_id WHERE state.state_id=${stateId};`,
    )
    response.send(result)
  },
)
module.exports = app
