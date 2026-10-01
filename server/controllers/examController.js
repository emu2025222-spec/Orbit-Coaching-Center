const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const list = asyncHandler(async (req, res) => {
  const filters = []
  const params = []
  if (req.user.role === 'student') { filters.push('(e.batch IS NULL OR e.batch = ? OR e.batch = \'\')'); params.push(req.user.batch || '') }
  if (req.query.status) { filters.push('e.status = ?'); params.push(req.query.status) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const exams = await all(`SELECT e.*, COUNT(DISTINCT r.id) AS result_count FROM exams e LEFT JOIN results r ON r.exam_id = e.id${where} GROUP BY e.id ORDER BY e.exam_date DESC`, params)
  send(res, 200, exams)
})

const create = asyncHandler(async (req, res) => {
  const { title, exam_date, batch, total_marks = 100, room, status = 'scheduled' } = req.body
  if (!title || !exam_date) return send(res, 422, null, 'Exam title and date are required.')
  const result = await run('INSERT INTO exams (title, exam_date, batch, total_marks, room, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [title.trim(), exam_date, batch || null, Number(total_marks), room || null, status, req.user.id])
  send(res, 201, await get('SELECT * FROM exams WHERE id = ?', [result.id]), 'Exam created successfully.')
})

const update = asyncHandler(async (req, res) => {
  const current = await get('SELECT * FROM exams WHERE id = ?', [req.params.id])
  if (!current) return send(res, 404, null, 'Exam not found.')
  await run(`UPDATE exams SET title = ?, exam_date = ?, batch = ?, total_marks = ?, room = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    req.body.title?.trim() || current.title, req.body.exam_date || current.exam_date, req.body.batch ?? current.batch,
    req.body.total_marks === undefined ? current.total_marks : Number(req.body.total_marks), req.body.room ?? current.room,
    req.body.status || current.status, current.id,
  ])
  send(res, 200, await get('SELECT * FROM exams WHERE id = ?', [current.id]), 'Exam updated successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const result = await run('DELETE FROM exams WHERE id = ?', [req.params.id])
  if (!result.changes) return send(res, 404, null, 'Exam not found.')
  send(res, 200, null, 'Exam deleted successfully.')
})

module.exports = { list, create, update, remove }
