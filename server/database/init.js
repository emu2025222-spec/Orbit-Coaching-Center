const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

const {
  connectMongoDB,
  getMongoDB,
} = require('../config/mongodb')

async function initializeDatabase() {
  // Connect MongoDB first
  await connectMongoDB()

  // Student photo directory
  fs.mkdirSync(
    path.join(
      __dirname,
      '..',
      'uploads',
      'students'
    ),
    { recursive: true }
  )

  const db = getMongoDB()

  // Admin account
  const adminEmail =
    process.env.ADMIN_EMAIL ||
    'admin@orbit.local'

  const emailRegex = new RegExp(
    `^${adminEmail.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}$`,
    'i'
  )

  const existingAdmin =
    await db.collection('users').findOne({
      email: emailRegex,
    })

  if (!existingAdmin) {
    const hash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD ||
        'ChangeMe123!',
      12
    )

    const lastUser =
      await db
        .collection('users')
        .find({})
        .sort({ id: -1 })
        .limit(1)
        .next()

    const nextId = lastUser
      ? Number(lastUser.id) + 1
      : 1

    const now =
      new Date().toISOString()

    await db.collection('users').insertOne({
      id: nextId,
      email: adminEmail,
      full_name:
        process.env.ADMIN_NAME ||
        'Orbit Administrator',
      password_hash: hash,
      role: 'admin',
      is_active: true,
      created_at: now,
      updated_at: now,
    })

    console.log(
      `Initial administrator created: ${adminEmail}`
    )
  } else {
    console.log(
      'Administrator already exists.'
    )
  }

  console.log(
    'MongoDB database initialization completed.'
  )
}

module.exports = initializeDatabase