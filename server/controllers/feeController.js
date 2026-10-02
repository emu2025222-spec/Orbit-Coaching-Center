const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const MONTHLY_FEES = 'monthly_fees'
const EXAM_FEES = 'exam_fees'
const STUDENTS = 'students'
const USERS = 'users'
const EXAMS = 'exams'

const feeStatus = (amount, paidAmount, explicit) =>
  explicit ||
  (
    paidAmount >= amount
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'due'
  )

async function buildMonthlyFee(fee) {
  if (!fee) return null

  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(fee.student_id),
  })

  if (!student) return null

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  return {
    ...fee,
    student_code: student.student_code,
    student_name: user.full_name,
    student_email: user.email,
  }
}

async function buildExamFee(fee) {
  if (!fee) return null

  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(fee.student_id),
  })

  if (!student) return null

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  let exam = null

  if (fee.exam_id) {
    exam = await db.collection(EXAMS).findOne({
      id: Number(fee.exam_id),
    })
  }

  return {
    ...fee,
    exam_title: exam ? exam.title : null,
    student_code: student.student_code,
    student_name: user.full_name,
    student_email: user.email,
  }
}

const listFees = (type) =>
  asyncHandler(async (req, res) => {
    const db = getMongoDB()

    const collection =
      type === 'monthly'
        ? MONTHLY_FEES
        : EXAM_FEES

    const filters = {}

    const studentId =
      req.studentId ||
      req.query.studentId

    if (studentId) {
      filters.student_id = Number(studentId)
    }

    if (req.query.status) {
      filters.status = req.query.status
    }

    if (
      type === 'monthly' &&
      req.query.month
    ) {
      filters.fee_month = req.query.month
    }

    if (
      type === 'exam' &&
      req.query.examId
    ) {
      filters.exam_id = Number(req.query.examId)
    }

    const rows = await db
      .collection(collection)
      .find(filters)
      .sort({ created_at: -1 })
      .toArray()

    const result = []

    for (const row of rows) {
      const built =
        type === 'monthly'
          ? await buildMonthlyFee(row)
          : await buildExamFee(row)

      if (built) {
        result.push(built)
      }
    }

    send(res, 200, result)
  })

const createMonthly = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    student_id,
    fee_month,
    amount,
    paid_amount = 0,
    status,
    paid_at,
    note,
  } = req.body

  if (
    !student_id ||
    !/^\d{4}-\d{2}$/.test(fee_month || '') ||
    Number(amount) < 0
  ) {
    return send(
      res,
      422,
      null,
      'Student, valid fee month and amount are required.'
    )
  }

  const student = await db.collection(STUDENTS).findOne({
    id: Number(student_id),
  })

  if (!student) {
    return send(
      res,
      404,
      null,
      'Student not found.'
    )
  }

  const paid = Number(paid_amount || 0)
  const numericAmount = Number(amount)

  const existing = await db
    .collection(MONTHLY_FEES)
    .findOne({
      student_id: Number(student_id),
      fee_month,
    })

  if (existing) {
    return send(
      res,
      409,
      null,
      'Monthly fee for this month already exists.'
    )
  }

  const now = new Date().toISOString()

  const nextId = await getNextId(MONTHLY_FEES)

  await db.collection(MONTHLY_FEES).insertOne({
    id: nextId,
    student_id: Number(student_id),
    fee_month,
    amount: numericAmount,
    paid_amount: paid,
    status: feeStatus(
      numericAmount,
      paid,
      status
    ),
    paid_at: paid_at || null,
    note: note || null,
    received_by: req.user.id,
    created_at: now,
    updated_at: now,
  })

  const created = await db
    .collection(MONTHLY_FEES)
    .findOne({
      id: nextId,
    })

  send(
    res,
    201,
    await buildMonthlyFee(created),
    'Monthly fee added successfully.'
  )
})

const updateMonthly = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db
    .collection(MONTHLY_FEES)
    .findOne({
      id: Number(req.params.id),
    })

  if (!current) {
    return send(
      res,
      404,
      null,
      'Monthly fee record not found.'
    )
  }

  const amount =
    req.body.amount === undefined
      ? current.amount
      : Number(req.body.amount)

  const paid =
    req.body.paid_amount === undefined
      ? current.paid_amount
      : Number(req.body.paid_amount)

  const feeMonth =
    req.body.fee_month ||
    current.fee_month

  const duplicate = await db
    .collection(MONTHLY_FEES)
    .findOne({
      student_id: current.student_id,
      fee_month: feeMonth,
      id: { $ne: current.id },
    })

  if (duplicate) {
    return send(
      res,
      409,
      null,
      'Monthly fee for this month already exists.'
    )
  }

  await db.collection(MONTHLY_FEES).updateOne(
    {
      id: current.id,
    },
    {
      $set: {
        fee_month: feeMonth,
        amount,
        paid_amount: paid,
        status: feeStatus(
          amount,
          paid,
          req.body.status
        ),
        paid_at:
          req.body.paid_at !== undefined
            ? req.body.paid_at
            : current.paid_at,
        note:
          req.body.note !== undefined
            ? req.body.note
            : current.note,
        received_by: req.user.id,
        updated_at: new Date().toISOString(),
      },
    }
  )

  const updated = await db
    .collection(MONTHLY_FEES)
    .findOne({
      id: current.id,
    })

  send(
    res,
    200,
    await buildMonthlyFee(updated),
    'Monthly fee updated successfully.'
  )
})

const createExam = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    student_id,
    exam_id,
    fee_name,
    amount,
    paid_amount = 0,
    status,
    paid_at,
    note,
  } = req.body

  if (
    !student_id ||
    !fee_name ||
    Number(amount) < 0
  ) {
    return send(
      res,
      422,
      null,
      'Student, fee name and amount are required.'
    )
  }

  const student = await db.collection(STUDENTS).findOne({
    id: Number(student_id),
  })

  if (!student) {
    return send(
      res,
      404,
      null,
      'Student not found.'
    )
  }

  if (exam_id) {
    const exam = await db.collection(EXAMS).findOne({
      id: Number(exam_id),
    })

    if (!exam) {
      return send(
        res,
        404,
        null,
        'Exam not found.'
      )
    }
  }

  const paid = Number(paid_amount || 0)
  const numericAmount = Number(amount)
  const now = new Date().toISOString()
  const nextId = await getNextId(EXAM_FEES)

  await db.collection(EXAM_FEES).insertOne({
    id: nextId,
    student_id: Number(student_id),
    exam_id: exam_id
      ? Number(exam_id)
      : null,
    fee_name,
    amount: numericAmount,
    paid_amount: paid,
    status: feeStatus(
      numericAmount,
      paid,
      status
    ),
    paid_at: paid_at || null,
    note: note || null,
    received_by: req.user.id,
    created_at: now,
    updated_at: now,
  })

  const created = await db
    .collection(EXAM_FEES)
    .findOne({
      id: nextId,
    })

  send(
    res,
    201,
    await buildExamFee(created),
    'Exam fee added successfully.'
  )
})

const updateExam = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db
    .collection(EXAM_FEES)
    .findOne({
      id: Number(req.params.id),
    })

  if (!current) {
    return send(
      res,
      404,
      null,
      'Exam fee record not found.'
    )
  }

  const amount =
    req.body.amount === undefined
      ? current.amount
      : Number(req.body.amount)

  const paid =
    req.body.paid_amount === undefined
      ? current.paid_amount
      : Number(req.body.paid_amount)

  if (req.body.exam_id) {
    const exam = await db.collection(EXAMS).findOne({
      id: Number(req.body.exam_id),
    })

    if (!exam) {
      return send(
        res,
        404,
        null,
        'Exam not found.'
      )
    }
  }

  await db.collection(EXAM_FEES).updateOne(
    {
      id: current.id,
    },
    {
      $set: {
        exam_id:
          req.body.exam_id !== undefined
            ? (
                req.body.exam_id
                  ? Number(req.body.exam_id)
                  : null
              )
            : current.exam_id,

        fee_name:
          req.body.fee_name ||
          current.fee_name,

        amount,
        paid_amount: paid,

        status: feeStatus(
          amount,
          paid,
          req.body.status
        ),

        paid_at:
          req.body.paid_at !== undefined
            ? req.body.paid_at
            : current.paid_at,

        note:
          req.body.note !== undefined
            ? req.body.note
            : current.note,

        received_by: req.user.id,
        updated_at: new Date().toISOString(),
      },
    }
  )

  const updated = await db
    .collection(EXAM_FEES)
    .findOne({
      id: current.id,
    })

  send(
    res,
    200,
    await buildExamFee(updated),
    'Exam fee updated successfully.'
  )
})

const removeFee = (collectionName) =>
  asyncHandler(async (req, res) => {
    const db = getMongoDB()

    const result = await db
      .collection(collectionName)
      .deleteOne({
        id: Number(req.params.id),
      })

    if (!result.deletedCount) {
      return send(
        res,
        404,
        null,
        'Fee record not found.'
      )
    }

    send(
      res,
      200,
      null,
      'Fee record deleted successfully.'
    )
  })

async function getNextId(collectionName) {
  const db = getMongoDB()

  const last = await db
    .collection(collectionName)
    .find({})
    .sort({ id: -1 })
    .limit(1)
    .next()

  return last
    ? Number(last.id) + 1
    : 1
}

module.exports = {
  listMonthly: listFees('monthly'),
  listExam: listFees('exam'),

  createMonthly,
  updateMonthly,

  createExam,
  updateExam,

  removeMonthly:
    removeFee(MONTHLY_FEES),

  removeExam:
    removeFee(EXAM_FEES),
}