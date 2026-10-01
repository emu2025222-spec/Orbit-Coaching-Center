const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const attendanceSelect = `SELECT a.*, s.student_code, u.full_name AS student_name
  FROM attendance a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id`

const list = asyncHandler(async (req, res) => {
  const filters = []
  const params = []
  const studentId = req.studentId || req.query.studentId
  if (studentId) { filters.push('a.student_id = ?'); params.push(studentId) }
  if (req.query.date) { filters.push('a.attendance_date = ?'); params.push(req.query.date) }
  if (req.query.from) { filters.push('a.attendance_date >= ?'); params.push(req.query.from) }
  if (req.query.to) { filters.push('a.attendance_date <= ?'); params.push(req.query.to) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const rows = await all(`${attendanceSelect}${where} ORDER BY a.attendance_date DESC, u.full_name ASC`, params)
  send(res, 200, rows)
})

const mark = asyncHandler(async (req, res) => {
  const attendanceDate = req.body.attendance_date || new Date().toISOString().slice(0, 10)
  const records = Array.isArray(req.body.records) ? req.body.records : [req.body]
  if (!records.length || records.some((record) => !record.student_id || !record.status)) return send(res, 422, null, 'Every attendance record needs student_id and status.')
  for (const record of records) {
    await run(`INSERT INTO attendance (student_id, attendance_date, status, note, marked_by) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id, attendance_date) DO UPDATE SET status = excluded.status, note = excluded.note, marked_by = excluded.marked_by, updated_at = CURRENT_TIMESTAMP`, [
      record.student_id, attendanceDate, record.status, record.note || null, req.user.id,
    ])
  }
  const ids = records.map((record) => Number(record.student_id))
  const placeholders = ids.map(() => '?').join(',')
  const rows = await all(`${attendanceSelect} WHERE a.attendance_date = ? AND a.student_id IN (${placeholders})`, [attendanceDate, ...ids])
  send(res, 200, rows, 'Attendance saved successfully.')
})

const summary = asyncHandler(async (req, res) => {
  const studentId = req.user.role === 'student' ? req.user.student_id : Number(req.query.studentId)
  if (!studentId) return send(res, 422, null, 'studentId is required.')
  const result = await get(`SELECT COUNT(*) AS total_days,
      SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended_days,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_days
    FROM attendance WHERE student_id = ?`, [studentId])
  const total = Number(result.total_days || 0)
  send(res, 200, { ...result, percentage: total ? Math.round((Number(result.attended_days || 0) / total) * 10000) / 100 : 0 })
})

module.exports = { list, mark, summary }
