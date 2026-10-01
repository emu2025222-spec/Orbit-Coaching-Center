const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

const send = (res, status, data = null, message = '') => res.status(status).json({ success: status < 400, message, data })

const pagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100)
  return { page, limit, offset: (page - 1) * limit }
}

const normalizePayment = (body) => ({
  studentId: Number(body.student_id),
  amount: Number(body.amount),
  paidAmount: Number(body.paid_amount ?? body.amount ?? 0),
  status: body.status || 'due',
  paidAt: body.paid_at || null,
  note: body.note || null,
})

module.exports = { asyncHandler, send, pagination, normalizePayment }
