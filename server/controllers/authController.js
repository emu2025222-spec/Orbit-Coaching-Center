const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const USERS = 'users'
const STUDENTS = 'students'

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  student_id: user.student_id || null,
  student_code: user.student_code || null,
  batch: user.batch || null,
  photo_path: user.photo_path || null,
})

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '12h',
    }
  )

const login = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    login: loginValue,
    password,
    role,
  } = req.body

  if (!loginValue || !password) {
    return send(
      res,
      422,
      null,
      'Login and password are required.'
    )
  }

  const value = loginValue.trim()

  const escapedValue = value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  )

  const loginRegex = new RegExp(
    `^${escapedValue}$`,
    'i'
  )

  // Search by email first
  let user = await db.collection(USERS).findOne({
    email: loginRegex,
  })

  // If not found, search by student code
  if (!user) {
    const student = await db.collection(STUDENTS).findOne({
      student_code: loginRegex,
    })

    if (student) {
      user = await db.collection(USERS).findOne({
        id: Number(student.user_id),
      })

      if (user) {
        user.student_id = student.id
        user.student_code = student.student_code
        user.batch = student.batch
        user.photo_path = student.photo_path
      }
    }
  } else if (user.role === 'student') {
    const student = await db.collection(STUDENTS).findOne({
      user_id: Number(user.id),
    })

    if (student) {
      user.student_id = student.id
      user.student_code = student.student_code
      user.batch = student.batch
      user.photo_path = student.photo_path
    }
  }

  if (
    !user ||
    !user.is_active ||
    (role && user.role !== role)
  ) {
    return send(
      res,
      401,
      null,
      'Invalid login credentials.'
    )
  }

  const valid = await bcrypt.compare(
    password,
    user.password_hash
  )

  if (!valid) {
    return send(
      res,
      401,
      null,
      'Invalid login credentials.'
    )
  }

  return send(
    res,
    200,
    {
      token: signToken(user),
      user: publicUser(user),
    },
    'Login successful.'
  )
})

const me = asyncHandler(async (req, res) =>
  send(res, 200, {
    user: publicUser(req.user),
  })
)

module.exports = {
  login,
  me,
  publicUser,
}