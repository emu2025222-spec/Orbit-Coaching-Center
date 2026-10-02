const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const ATTENDANCE = 'attendance'
const STUDENTS = 'students'
const USERS = 'users'

async function buildAttendance(record) {
  if (!record) return null

  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(record.student_id),
  })

  if (!student) return null

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  return {
    ...record,
    student_code: student.student_code,
    student_name: user.full_name,
  }
}

const list = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const filters = {}

  const studentId =
    req.studentId ||
    req.query.studentId

  if (studentId) {
    filters.student_id = Number(studentId)
  }

  if (req.query.date) {
    filters.attendance_date = req.query.date
  }

  if (req.query.from || req.query.to) {
    filters.attendance_date = {}

    if (req.query.from) {
      filters.attendance_date.$gte = req.query.from
    }

    if (req.query.to) {
      filters.attendance_date.$lte = req.query.to
    }
  }

  const rows = await db
    .collection(ATTENDANCE)
    .find(filters)
    .sort({
      attendance_date: -1,
    })
    .toArray()

  const result = []

  for (const row of rows) {
    const built = await buildAttendance(row)

    if (built) {
      result.push(built)
    }
  }

  // Same ordering as old SQLite query:
  // date DESC, student name ASC
  result.sort((a, b) => {
    if (
      a.attendance_date !==
      b.attendance_date
    ) {
      return b.attendance_date.localeCompare(
        a.attendance_date
      )
    }

    return a.student_name.localeCompare(
      b.student_name
    )
  })

  send(res, 200, result)
})

const mark = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const attendanceDate =
    req.body.attendance_date ||
    new Date().toISOString().slice(0, 10)

  const records = Array.isArray(req.body.records)
    ? req.body.records
    : [req.body]

  if (
    !records.length ||
    records.some(
      (record) =>
        !record.student_id ||
        !record.status
    )
  ) {
    return send(
      res,
      422,
      null,
      'Every attendance record needs student_id and status.'
    )
  }

  const validStatuses = [
    'present',
    'absent',
    'late',
    'excused',
  ]

  for (const record of records) {
    if (
      !validStatuses.includes(record.status)
    ) {
      return send(
        res,
        422,
        null,
        `Invalid attendance status: ${record.status}`
      )
    }

    const student = await db
      .collection(STUDENTS)
      .findOne({
        id: Number(record.student_id),
      })

    if (!student) {
      return send(
        res,
        404,
        null,
        `Student ${record.student_id} not found.`
      )
    }
  }

  const now = new Date().toISOString()

  for (const record of records) {
    const studentId =
      Number(record.student_id)

    await db.collection(ATTENDANCE).updateOne(
      {
        student_id: studentId,
        attendance_date: attendanceDate,
      },
      {
        $set: {
          status: record.status,
          note: record.note || null,
          marked_by: req.user.id,
          updated_at: now,
        },

        $setOnInsert: {
          id: await getNextId(ATTENDANCE),
          student_id: studentId,
          attendance_date: attendanceDate,
          created_at: now,
        },
      },
      {
        upsert: true,
      }
    )
  }

  const ids = records.map(
    (record) => Number(record.student_id)
  )

  const rows = await db
    .collection(ATTENDANCE)
    .find({
      attendance_date: attendanceDate,
      student_id: {
        $in: ids,
      },
    })
    .toArray()

  const result = []

  for (const row of rows) {
    const built = await buildAttendance(row)

    if (built) {
      result.push(built)
    }
  }

  result.sort((a, b) =>
    a.student_name.localeCompare(
      b.student_name
    )
  )

  send(
    res,
    200,
    result,
    'Attendance saved successfully.'
  )
})

const summary = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const studentId =
    req.user.role === 'student'
      ? req.user.student_id
      : Number(req.query.studentId)

  if (!studentId) {
    return send(
      res,
      422,
      null,
      'studentId is required.'
    )
  }

  const rows = await db
    .collection(ATTENDANCE)
    .find({
      student_id: Number(studentId),
    })
    .toArray()

  const total = rows.length

  const attended = rows.filter(
    (row) =>
      row.status === 'present' ||
      row.status === 'late'
  ).length

  const absent = rows.filter(
    (row) =>
      row.status === 'absent'
  ).length

  const percentage = total
    ? Math.round(
        (attended / total) * 10000
      ) / 100
    : 0

  send(res, 200, {
    total_days: total,
    attended_days: attended,
    absent_days: absent,
    percentage,
  })
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
  mark,
  summary,
}