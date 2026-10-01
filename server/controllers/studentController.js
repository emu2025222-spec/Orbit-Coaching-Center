const bcrypt = require('bcryptjs')
const { all, get, run } = require('../config/db')
const { asyncHandler, send, pagination } = require('../utils/api')

const studentSelect = `SELECT s.id, s.student_code, s.phone, s.guardian_name, s.guardian_phone, s.batch, s.address,
  s.date_of_birth, s.photo_path, s.enrolled_at, u.id AS user_id, u.email, u.full_name, u.is_active
  FROM students s JOIN users u ON u.id = s.user_id`

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = pagination(req.query)
  const filters = []
  const params = []
  if (req.query.search) {
    filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR s.student_code LIKE ? OR s.phone LIKE ?)')
    const search = `%${req.query.search.trim()}%`
    params.push(search, search, search, search)
  }
  if (req.query.batch) { filters.push('s.batch = ?'); params.push(req.query.batch) }
  if (req.query.active) { filters.push('u.is_active = ?'); params.push(req.query.active === 'true' ? 1 : 0) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const count = await get(`SELECT COUNT(*) AS total ${studentSelect.replace(/^SELECT[\s\S]+?FROM/, 'FROM')}${where}`, params)
  const rows = await all(`${studentSelect}${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  send(res, 200, { rows, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } })
})

const getOne = asyncHandler(async (req, res) => {
  const student = await get(`${studentSelect} WHERE s.id = ?`, [req.params.id])
  if (!student) return send(res, 404, null, 'Student not found.')
  send(res, 200, student)
})

const getMine = asyncHandler(async (req, res) => {
  const student = await get(`${studentSelect} WHERE s.id = ?`, [req.user.student_id])
  if (!student) return send(res, 404, null, 'Student profile not found.')
  send(res, 200, student)
})

const create = asyncHandler(async (req, res) => {
  const { full_name, email, password, student_code, phone, guardian_name, guardian_phone, batch, address, date_of_birth } = req.body
  if (!full_name || !email || !password || !student_code) return send(res, 422, null, 'Full name, email, password and student code are required.')
  if (password.length < 8) return send(res, 422, null, 'Student password must be at least 8 characters.')
  const duplicate = await get(`SELECT u.id FROM users u LEFT JOIN students s ON s.user_id = u.id
    WHERE lower(u.email) = lower(?) OR lower(s.student_code) = lower(?)`, [email.trim(), student_code.trim()])
  if (duplicate) return send(res, 409, null, 'Email or student code already exists.')

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await run('INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, ?)', [email.trim(), full_name.trim(), passwordHash, 'student'])
  const photoPath = req.file ? `/uploads/students/${req.file.filename}` : null
  const student = await run(`INSERT INTO students (user_id, student_code, phone, guardian_name, guardian_phone, batch, address, date_of_birth, photo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [user.id, student_code.trim(), phone || null, guardian_name || null, guardian_phone || null, batch || null, address || null, date_of_birth || null, photoPath])
  const created = await get(`${studentSelect} WHERE s.id = ?`, [student.id])
  send(res, 201, created, 'Student created successfully.')
})

const update = asyncHandler(async (req, res) => {
  const current = await get(`${studentSelect} WHERE s.id = ?`, [req.params.id])
  if (!current) return send(res, 404, null, 'Student not found.')
  const body = req.body
  if (body.email && body.email.trim().toLowerCase() !== current.email.toLowerCase()) {
    const duplicate = await get('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?', [body.email.trim(), current.user_id])
    if (duplicate) return send(res, 409, null, 'Email already exists.')
  }
  if (body.student_code && body.student_code.trim().toLowerCase() !== current.student_code.toLowerCase()) {
    const duplicate = await get('SELECT id FROM students WHERE lower(student_code) = lower(?) AND id != ?', [body.student_code.trim(), current.id])
    if (duplicate) return send(res, 409, null, 'Student code already exists.')
  }
  let passwordHash = null
  if (body.password) {
    if (body.password.length < 8) return send(res, 422, null, 'Student password must be at least 8 characters.')
    passwordHash = await bcrypt.hash(body.password, 12)
  }
  await run(`UPDATE users SET full_name = ?, email = ?, is_active = ?, password_hash = COALESCE(?, password_hash), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    body.full_name?.trim() || current.full_name, body.email?.trim() || current.email,
    body.is_active === undefined ? current.is_active : Number(Boolean(body.is_active)), passwordHash, current.user_id,
  ])
  const photoPath = req.file ? `/uploads/students/${req.file.filename}` : current.photo_path
  await run(`UPDATE students SET student_code = ?, phone = ?, guardian_name = ?, guardian_phone = ?, batch = ?, address = ?, date_of_birth = ?, photo_path = ? WHERE id = ?`, [
    body.student_code?.trim() || current.student_code, body.phone ?? current.phone, body.guardian_name ?? current.guardian_name,
    body.guardian_phone ?? current.guardian_phone, body.batch ?? current.batch, body.address ?? current.address,
    body.date_of_birth ?? current.date_of_birth, photoPath, current.id,
  ])
  const updated = await get(`${studentSelect} WHERE s.id = ?`, [current.id])
  send(res, 200, updated, 'Student updated successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const student = await get('SELECT user_id FROM students WHERE id = ?', [req.params.id])
  if (!student) return send(res, 404, null, 'Student not found.')
  await run('DELETE FROM users WHERE id = ?', [student.user_id])
  send(res, 200, null, 'Student deleted successfully.')
})

module.exports = { list, getOne, getMine, create, update, remove }
