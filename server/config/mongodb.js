const { MongoClient } = require('mongodb')

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error('MONGODB_URI is not configured.')
}

const client = new MongoClient(uri, {
  family: 4,
  serverSelectionTimeoutMS: 10000,
})

let db

async function connectMongoDB() {
  if (db) return db

  await client.connect()

  db = client.db('orbit-coaching')

  console.log('MongoDB connected successfully.')

  return db
}

function getMongoDB() {
  if (!db) {
    throw new Error('MongoDB is not connected. Call connectMongoDB() first.')
  }

  return db
}

module.exports = {
  client,
  connectMongoDB,
  getMongoDB,
}