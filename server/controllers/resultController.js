const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const resultSelect = `SELECT r.*, e.title AS exam_title, e.exam_date, s.student_code, u.full_name AS student_name
  FROM results r JOIN exams e ON e.id = r.exam_id JOIN students s ON s.id = r.student_id JOIN users u ON u.id = s.user_id`
const gradeFor = (marks, total) => {
  const percent = (Number(marks) / Number(total)) * 100
  if (percent >= 80) return 'A+'
  if (percent >= 70) return 'A'
  if (percent >= 60) return 'A-'
  if (percent >= 50) return 'B'
  if (percent >= 40) return 'C'
  if (percent >= 33) return 'D'
  return 'F'
}

const list = asyncHandler(async (req, res) => {
  const filters = []
  const params = []
  const studentId = req.studentId || req.query.studentId
  if (studentId) { filters.push('r.student_id = ?'); params.push(studentId) }
  if (req.query.examId) { filters.push('r.exam_id = ?'); params.push(req.query.examId) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const rows = await all(`${resultSelect}${where} ORDER BY e.exam_date DESC, r.subject ASC`, params)
  send(res, 200, rows)
})

const create = asyncHandler(async (req, res) => {
  const { exam_id, student_id, subject, marks, total_marks = 100, grade, remark } = req.body
  if (!exam_id || !student_id || !subject || marks === undefined || !Number(total_marks)) return send(res, 422, null, 'Exam, student, subject, marks and total marks are required.')
  const result = await run(`INSERT INTO results (exam_id, student_id, subject, marks, total_marks, grade, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [exam_id, student_id, subject.trim(), Number(marks), Number(total_marks), grade || gradeFor(marks, total_marks), remark || null])
  send(res, 201, await get(`${resultSelect} WHERE r.id = ?`, [result.id]), 'Result added successfully.')
})

const update = asyncHandler(async (req, res) => {
  const current = await get('SELECT * FROM results WHERE id = ?', [req.params.id])
  if (!current) return send(res, 404, null, 'Result not found.')
  const marks = req.body.marks === undefined ? current.marks : Number(req.body.marks)
  const totalMarks = req.body.total_marks === undefined ? current.total_marks : Number(req.body.total_marks)
  await run(`UPDATE results SET subject = ?, marks = ?, total_marks = ?, grade = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    req.body.subject?.trim() || current.subject, marks, totalMarks, req.body.grade || gradeFor(marks, totalMarks), req.body.remark ?? current.remark, current.id,
  ])
  send(res, 200, await get(`${resultSelect} WHERE r.id = ?`, [current.id]), 'Result updated successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const result = await run('DELETE FROM results WHERE id = ?', [req.params.id])
  if (!result.changes) return send(res, 404, null, 'Result not found.')
  send(res, 200, null, 'Result deleted successfully.')
})

module.exports = { list, create, update, remove }
