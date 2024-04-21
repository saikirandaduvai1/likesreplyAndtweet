const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbpath = path.join(__dirname, 'twitterClone.db')
let db = null
const initializationDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('coding runing at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`error at ${e.massege}`)
    process.exit(1)
  }
}
initializationDBAndServer()

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.user_id = payload.user_id
        next()
      }
    })
  }
}

const getfollowerpoepleIduser = async username => {
  const getfollowerpoepleQuery = `
  SELECT 
  follower_user_id 
  FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE
  user.username = '${username}';
  `
  const followerPoeple = await db.all(getfollowerpoepleQuery)
  const arrayOfIds = followerPoeple.map(eachUser => {
    eachUser.follower_user_id
  })
  return arrayOfIds
}
//API 1
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hashedpassword = await bcrypt.hash(request.body.password, 10)
  const usernameQuery = `SELECT * FROM user WHERE username = '${username}'; `
  const useridentity = await db.get(usernameQuery)
  if (useridentity !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else if (password.length < 6) {
    response.status(400)
    response.send('Password is too short')
  } else {
    const postuserQuery = `
        INSERT INTO
        user (name, username, password, gender)
        VALUES
        ('${name}','${username}','${hashedpassword}','${gender}');
        `
    await db.run(postuserQuery)
    response.send('User created successfully')
  }
})
//API 2
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userQuery = `SELECT * FROM user WHERE username='${username}';`
  const useridentity = await db.get(userQuery)
  if (useridentity === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispasswordMatched = await bcrypt.compare(
      password,
      useridentity.password,
    )
    if (ispasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(useridentity, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 3
app.get('/user/tweets/feed/', authentication, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, password, gender} = payload
  const followerIdpoeples = await getfollowerpoepleIduser(username)
  const getusertweetsQuery = `
  SELECT 
  user.username,
  tweet.tweet,
  tweet.date_time AS dateTime
  FROM
  user INNER JOIN tweet ON user.user_id=tweet.user_id
  WHERE 
  user.user_id IN (${followerIdpoeples})
  ORDER BY
  tweet.date_time DESC
  LIMIT 4
  ;
  `
  const users = await db.all(getusertweetsQuery)
  response.send(users)
})
//API 4
app.get('/user/following/', authentication, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, password, gender} = payload
  const userfollowerpoeplename = `
  SELECT user.name
  FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE follower.follower_user_id = '${user_id}'
  AND user.username='${username}';
  `
  const followername = await db.all(userfollowerpoeplename)
  response.send(followername)
})
//API 5
app.get('/user/followers/', authentication, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, password, gender} = payload
  const userfollowerpoeplename = `
  SELECT DISTINCT user.name
  FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE follower.follower_user_id = '${user_id}';
  `
  const followername = await db.all(userfollowerpoeplename)
  response.send(followername)
})
//API 6

app.get('/tweets/:tweetId/', authentication, async (request, response) => {
  const {payload} = request
  const {tweetId} = request.params
  const {user_id, name, username, password, gender} = payload
  const checkuserquery = `
  SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};
  `
  const tweetResult = await db.get(checkuserquery)
  const followerQuery = `
  SELECT * 
  FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
  WHERE 
  follower.following_user_id=${user_id};
  `
  const userfollower = await db.all(followerQuery)
  if (
    userfollower.some(item => item.following_user_id === tweetResult.user_id)
  ) {
    const getTweetDetailQuery = `
    SELECT 
    tweet,
    COUNT(DISTINCT(like.like_id)) AS likes,
    COUNT(DISTINCT(reply.reply_id)) AS replies,
    date_time AS dateTime
    FROM 
    (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id) AS TS
     INNER JOIN reply.tweet_id=TS.tweet_id
    WHERE 
    tweet.tweet_id=${tweetId} AND tweet.user_id=${userfollower[0].user_id};
    `
    const tweetDetails = await db.get(getTweetDetailQuery)
    console.send(tweetDetails)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

// API 7

module.exports = app
