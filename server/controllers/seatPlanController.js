const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const SEAT_PLANS = 'seat_plans'
const EXAMS = 'exams'
const STUDENTS = 'students'
const USERS = 'users'

async function buildSeatPlan(plan) {
  if (!plan) return null

  const db = getMongoDB()

  const exam = await db.collection(EXAMS).findOne({
    id: Number(plan.exam_id),
  })

  const student = await db.collection(STUDENTS).findOne({
    id: Number(plan.student_id),
  })

  if (!exam || !student) return null

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  return {
    ...plan,
    exam_title: exam.title,
    exam_date: exam.exam_date,
    student_code: student.student_code,
    student_name: user.full_name,
    batch: student.batch,
  }
}

const list = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const filters = {}

  if (req.user.role === 'student') {
    filters.student_id = Number(
      req.user.student_id
    )
  }

  if (req.query.examId) {
    filters.exam_id = Number(
      req.query.examId
    )
  }

  const rows = await db
    .collection(SEAT_PLANS)
    .find(filters)
    .toArray()

  const result = []

  for (const row of rows) {
    const built = await buildSeatPlan(row)

    if (built) {
      result.push(built)
    }
  }

  result.sort((a, b) => {
    const dateCompare =
      String(b.exam_date || '').localeCompare(
        String(a.exam_date || '')
      )

    if (dateCompare !== 0) {
      return dateCompare
    }

    const roomCompare =
      String(a.room || '').localeCompare(
        String(b.room || '')
      )

    if (roomCompare !== 0) {
      return roomCompare
    }

    return String(
      a.seat_number || ''
    ).localeCompare(
      String(b.seat_number || '')
    )
  })

  send(res, 200, result)
})

const save = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const plans = Array.isArray(req.body.plans)
    ? req.body.plans
    : [req.body]

  if (
    !plans.length ||
    plans.some(
      (plan) =>
        !plan.exam_id ||
        !plan.student_id ||
        !plan.room ||
        !plan.seat_number
    )
  ) {
    return send(
      res,
      422,
      null,
      'Every seat plan needs exam_id, student_id, room and seat_number.'
    )
  }

  for (const plan of plans) {
    const exam = await db.collection(EXAMS).findOne({
      id: Number(plan.exam_id),
    })

    if (!exam) {
      return send(
        res,
        404,
        null,
        `Exam ${plan.exam_id} not found.`
      )
    }

    const student = await db.collection(STUDENTS).findOne({
      id: Number(plan.student_id),
    })

    if (!student) {
      return send(
        res,
        404,
        null,
        `Student ${plan.student_id} not found.`
      )
    }
  }

  for (const plan of plans) {
    const examId = Number(plan.exam_id)
    const studentId = Number(plan.student_id)
    const room = plan.room.trim()
    const seatNumber =
      plan.seat_number.trim()

    // Check whether another student already
    // has this exact seat in the same exam.
    const occupiedSeat = await db
      .collection(SEAT_PLANS)
      .findOne({
        exam_id: examId,
        room,
        seat_number: seatNumber,
        student_id: {
          $ne: studentId,
        },
      })

    if (occupiedSeat) {
      return send(
        res,
        409,
        null,
        `Seat ${seatNumber} in room ${room} is already assigned.`
      )
    }

    const existing = await db
      .collection(SEAT_PLANS)
      .findOne({
        exam_id: examId,
        student_id: studentId,
      })

    if (existing) {
      await db.collection(SEAT_PLANS).updateOne(
        {
          id: existing.id,
        },
        {
          $set: {
            room,
            seat_number: seatNumber,
          },
        }
      )
    } else {
      const now =
        new Date().toISOString()

      const nextId =
        await getNextId(SEAT_PLANS)

      await db.collection(SEAT_PLANS).insertOne({
        id: nextId,
        exam_id: examId,
        student_id: studentId,
        room,
        seat_number: seatNumber,
        created_at: now,
      })
    }
  }

  send(
    res,
    200,
    null,
    'Seat plan saved successfully.'
  )
})

const remove = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const result = await db
    .collection(SEAT_PLANS)
    .deleteOne({
      id: Number(req.params.id),
    })

  if (!result.deletedCount) {
    return send(
      res,
      404,
      null,
      'Seat plan not found.'
    )
  }

  send(
    res,
    200,
    null,
    'Seat plan deleted successfully.'
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
  list,
  save,
  remove,
}