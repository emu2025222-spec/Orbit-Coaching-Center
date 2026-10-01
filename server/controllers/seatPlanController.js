const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const seatSelect = `SELECT sp.*, e.title AS exam_title, e.exam_date, s.student_code, u.full_name AS student_name, s.batch
  FROM seat_plans sp JOIN exams e ON e.id = sp.exam_id JOIN students s ON s.id = sp.student_id JOIN users u ON u.id = s.user_id`

const list = asyncHandler(async (req, res) => {
  const filters = []
  const params = []
  if (req.user.role === 'student') { filters.push('sp.student_id = ?'); params.push(req.user.student_id) }
  if (req.query.examId) { filters.push('sp.exam_id = ?'); params.push(req.query.examId) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  send(res, 200, await all(`${seatSelect}${where} ORDER BY e.exam_date DESC, sp.room, sp.seat_number`, params))
})

const save = asyncHandler(async (req, res) => {
  const plans = Array.isArray(req.body.plans) ? req.body.plans : [req.body]
  if (!plans.length || plans.some((plan) => !plan.exam_id || !plan.student_id || !plan.room || !plan.seat_number)) return send(res, 422, null, 'Every seat plan needs exam_id, student_id, room and seat_number.')
  for (const plan of plans) {
    await run(`INSERT INTO seat_plans (exam_id, student_id, room, seat_number) VALUES (?, ?, ?, ?)
      ON CONFLICT(exam_id, student_id) DO UPDATE SET room = excluded.room, seat_number = excluded.seat_number`, [plan.exam_id, plan.student_id, plan.room.trim(), plan.seat_number.trim()])
  }
  send(res, 200, null, 'Seat plan saved successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const result = await run('DELETE FROM seat_plans WHERE id = ?', [req.params.id])
  if (!result.changes) return send(res, 404, null, 'Seat plan not found.')
  send(res, 200, null, 'Seat plan deleted successfully.')
})

module.exports = { list, save, remove }
