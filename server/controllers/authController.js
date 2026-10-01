const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { get } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

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

const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' })

const login = asyncHandler(async (req, res) => {
  const { login: loginValue, password, role } = req.body
  if (!loginValue || !password) return send(res, 422, null, 'Login and password are required.')

  const user = await get(`SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.password_hash,
      s.id AS student_id, s.student_code, s.batch, s.photo_path
    FROM users u LEFT JOIN students s ON s.user_id = u.id
    WHERE lower(u.email) = lower(?) OR lower(s.student_code) = lower(?)`, [loginValue.trim(), loginValue.trim()])

  if (!user || !user.is_active || (role && user.role !== role)) return send(res, 401, null, 'Invalid login credentials.')
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return send(res, 401, null, 'Invalid login credentials.')

  return send(res, 200, { token: signToken(user), user: publicUser(user) }, 'Login successful.')
})

const me = asyncHandler(async (req, res) => send(res, 200, { user: publicUser(req.user) }))

module.exports = { login, me, publicUser }
