const jwt = require('jsonwebtoken')
const { getMongoDB } = require('../config/mongodb')
const { send, asyncHandler } = require('../utils/api')

const protect = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null

  if (!token) {
    return send(
      res,
      401,
      null,
      'Authentication token is required.'
    )
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    )

    const db = getMongoDB()

    const user = await db.collection('users').findOne({
      id: Number(payload.id),
    })

    if (!user || !user.is_active) {
      return send(
        res,
        401,
        null,
        'This account is no longer active.'
      )
    }

    let student = null

    if (user.role === 'student') {
      student = await db.collection('students').findOne({
        user_id: Number(user.id),
      })
    }

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      student_id: student?.id || null,
      student_code: student?.student_code || null,
      batch: student?.batch || null,
      photo_path: student?.photo_path || null,
    }

    next()
  } catch (error) {
    return send(
      res,
      401,
      null,
      'Invalid or expired authentication token.'
    )
  }
})

const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return send(
      res,
      403,
      null,
      'You do not have permission to perform this action.'
    )
  }

  next()
}

const studentScope = (req, res, next) => {
  const target = Number(
    req.params.studentId ||
    req.query.studentId ||
    req.body?.student_id ||
    0
  )

  if (
    req.user.role === 'student' &&
    target &&
    target !== req.user.student_id
  ) {
    return send(
      res,
      403,
      null,
      'Students may only access their own records.'
    )
  }

  if (
    req.user.role === 'student' &&
    !target
  ) {
    req.studentId =
      req.user.student_id
  } else {
    req.studentId =
      target || null
  }

  next()
}

module.exports = {
  protect,
  allow,
  studentScope,
}