const jwt = require('jsonwebtoken')
const { get } = require('../config/db')
const { send, asyncHandler } = require('../utils/api')

const protect = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  if (!token) return send(res, 401, null, 'Authentication token is required.')

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await get(`SELECT u.id, u.email, u.full_name, u.role, u.is_active, s.id AS student_id, s.student_code, s.batch, s.photo_path
      FROM users u LEFT JOIN students s ON s.user_id = u.id WHERE u.id = ?`, [payload.id])
    if (!user || !user.is_active) return send(res, 401, null, 'This account is no longer active.')
    req.user = user
    next()
  } catch (error) {
    return send(res, 401, null, 'Invalid or expired authentication token.')
  }
})

const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return send(res, 403, null, 'You do not have permission to perform this action.')
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

  if (req.user.role === 'student' && !target) {
    req.studentId = req.user.student_id
  } else {
    req.studentId = target || null
  }

  next()
}

module.exports = { protect, allow, studentScope }
