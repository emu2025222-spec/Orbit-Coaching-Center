const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const feeStatus = (amount, paidAmount, explicit) => explicit || (paidAmount >= amount ? 'paid' : paidAmount > 0 ? 'partial' : 'due')
const monthlySelect = `SELECT mf.*, s.student_code, u.full_name AS student_name, u.email AS student_email
  FROM monthly_fees mf JOIN students s ON s.id = mf.student_id JOIN users u ON u.id = s.user_id`
const examSelect = `SELECT ef.*, e.title AS exam_title, s.student_code, u.full_name AS student_name, u.email AS student_email
  FROM exam_fees ef JOIN students s ON s.id = ef.student_id JOIN users u ON u.id = s.user_id LEFT JOIN exams e ON e.id = ef.exam_id`

const listFees = (type) => asyncHandler(async (req, res) => {
  const select = type === 'monthly' ? monthlySelect : examSelect
  const table = type === 'monthly' ? 'mf' : 'ef'
  const filters = []
  const params = []
  const studentId = req.studentId || req.query.studentId
  if (studentId) { filters.push(`${table}.student_id = ?`); params.push(studentId) }
  if (req.query.status) { filters.push(`${table}.status = ?`); params.push(req.query.status) }
  if (type === 'monthly' && req.query.month) { filters.push('mf.fee_month = ?'); params.push(req.query.month) }
  if (type === 'exam' && req.query.examId) { filters.push('ef.exam_id = ?'); params.push(req.query.examId) }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const rows = await all(`${select}${where} ORDER BY ${table}.created_at DESC`, params)
  send(res, 200, rows)
})

const createMonthly = asyncHandler(async (req, res) => {
  const { student_id, fee_month, amount, paid_amount = 0, status, paid_at, note } = req.body
  if (!student_id || !/^\d{4}-\d{2}$/.test(fee_month || '') || Number(amount) < 0) return send(res, 422, null, 'Student, valid fee month and amount are required.')
  const student = await get('SELECT id FROM students WHERE id = ?', [student_id])
  if (!student) return send(res, 404, null, 'Student not found.')
  const paid = Number(paid_amount || 0)
  const result = await run(`INSERT INTO monthly_fees (student_id, fee_month, amount, paid_amount, status, paid_at, note, received_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [student_id, fee_month, Number(amount), paid, feeStatus(Number(amount), paid, status), paid_at || null, note || null, req.user.id])
  const row = await get(`${monthlySelect} WHERE mf.id = ?`, [result.id])
  send(res, 201, row, 'Monthly fee added successfully.')
})

const updateMonthly = asyncHandler(async (req, res) => {
  const current = await get('SELECT * FROM monthly_fees WHERE id = ?', [req.params.id])
  if (!current) return send(res, 404, null, 'Monthly fee record not found.')
  const amount = req.body.amount === undefined ? current.amount : Number(req.body.amount)
  const paid = req.body.paid_amount === undefined ? current.paid_amount : Number(req.body.paid_amount)
  await run(`UPDATE monthly_fees SET fee_month = ?, amount = ?, paid_amount = ?, status = ?, paid_at = ?, note = ?, received_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    req.body.fee_month || current.fee_month, amount, paid, feeStatus(amount, paid, req.body.status), req.body.paid_at ?? current.paid_at,
    req.body.note ?? current.note, req.user.id, current.id,
  ])
  send(res, 200, await get(`${monthlySelect} WHERE mf.id = ?`, [current.id]), 'Monthly fee updated successfully.')
})

const createExam = asyncHandler(async (req, res) => {
  const { student_id, exam_id, fee_name, amount, paid_amount = 0, status, paid_at, note } = req.body
  if (!student_id || !fee_name || Number(amount) < 0) return send(res, 422, null, 'Student, fee name and amount are required.')
  const student = await get('SELECT id FROM students WHERE id = ?', [student_id])
  if (!student) return send(res, 404, null, 'Student not found.')
  const paid = Number(paid_amount || 0)
  const result = await run(`INSERT INTO exam_fees (student_id, exam_id, fee_name, amount, paid_amount, status, paid_at, note, received_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [student_id, exam_id || null, fee_name, Number(amount), paid, feeStatus(Number(amount), paid, status), paid_at || null, note || null, req.user.id])
  send(res, 201, await get(`${examSelect} WHERE ef.id = ?`, [result.id]), 'Exam fee added successfully.')
})

const updateExam = asyncHandler(async (req, res) => {
  const current = await get('SELECT * FROM exam_fees WHERE id = ?', [req.params.id])
  if (!current) return send(res, 404, null, 'Exam fee record not found.')
  const amount = req.body.amount === undefined ? current.amount : Number(req.body.amount)
  const paid = req.body.paid_amount === undefined ? current.paid_amount : Number(req.body.paid_amount)
  await run(`UPDATE exam_fees SET exam_id = ?, fee_name = ?, amount = ?, paid_amount = ?, status = ?, paid_at = ?, note = ?, received_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    req.body.exam_id ?? current.exam_id, req.body.fee_name || current.fee_name, amount, paid, feeStatus(amount, paid, req.body.status),
    req.body.paid_at ?? current.paid_at, req.body.note ?? current.note, req.user.id, current.id,
  ])
  send(res, 200, await get(`${examSelect} WHERE ef.id = ?`, [current.id]), 'Exam fee updated successfully.')
})

const removeFee = (table) => asyncHandler(async (req, res) => {
  const result = await run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id])
  if (!result.changes) return send(res, 404, null, 'Fee record not found.')
  send(res, 200, null, 'Fee record deleted successfully.')
})

module.exports = { listMonthly: listFees('monthly'), listExam: listFees('exam'), createMonthly, updateMonthly, createExam, updateExam, removeMonthly: removeFee('monthly_fees'), removeExam: removeFee('exam_fees') }
