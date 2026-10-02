const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const RESULTS = 'results'
const EXAMS = 'exams'
const STUDENTS = 'students'
const USERS = 'users'

const gradeFor = (marks, total) => {
  const percent =
    (Number(marks) / Number(total)) * 100

  if (percent >= 80) return 'A+'
  if (percent >= 70) return 'A'
  if (percent >= 60) return 'A-'
  if (percent >= 50) return 'B'
  if (percent >= 40) return 'C'
  if (percent >= 33) return 'D'
  return 'F'
}

async function buildResult(result) {
  if (!result) return null

  const db = getMongoDB()

  const exam = await db.collection(EXAMS).findOne({
    id: Number(result.exam_id),
  })

  const student = await db.collection(STUDENTS).findOne({
    id: Number(result.student_id),
  })

  if (!exam || !student) return null

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  return {
    ...result,
    exam_title: exam.title,
    exam_date: exam.exam_date,
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

  if (req.query.examId) {
    filters.exam_id = Number(req.query.examId)
  }

  const rows = await db
    .collection(RESULTS)
    .find(filters)
    .toArray()

  const result = []

  for (const row of rows) {
    const built = await buildResult(row)

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

    return String(a.subject || '').localeCompare(
      String(b.subject || '')
    )
  })

  send(res, 200, result)
})

const create = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    exam_id,
    student_id,
    subject,
    marks,
    total_marks = 100,
    grade,
    remark,
  } = req.body

  if (
    !exam_id ||
    !student_id ||
    !subject ||
    marks === undefined ||
    !Number(total_marks)
  ) {
    return send(
      res,
      422,
      null,
      'Exam, student, subject, marks and total marks are required.'
    )
  }

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

  const existing = await db
    .collection(RESULTS)
    .findOne({
      exam_id: Number(exam_id),
      student_id: Number(student_id),
      subject: subject.trim(),
    })

  if (existing) {
    return send(
      res,
      409,
      null,
      'Result for this student, exam and subject already exists.'
    )
  }

  const numericMarks = Number(marks)
  const numericTotal = Number(total_marks)

  if (numericMarks < 0) {
    return send(
      res,
      422,
      null,
      'Marks cannot be negative.'
    )
  }

  if (numericMarks > numericTotal) {
    return send(
      res,
      422,
      null,
      'Marks cannot be greater than total marks.'
    )
  }

  const now = new Date().toISOString()
  const nextId = await getNextId(RESULTS)

  await db.collection(RESULTS).insertOne({
    id: nextId,
    exam_id: Number(exam_id),
    student_id: Number(student_id),
    subject: subject.trim(),
    marks: numericMarks,
    total_marks: numericTotal,
    grade:
      grade ||
      gradeFor(
        numericMarks,
        numericTotal
      ),
    remark: remark || null,
    created_at: now,
    updated_at: now,
  })

  const created = await db
    .collection(RESULTS)
    .findOne({
      id: nextId,
    })

  send(
    res,
    201,
    await buildResult(created),
    'Result added successfully.'
  )
})

const update = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db
    .collection(RESULTS)
    .findOne({
      id: Number(req.params.id),
    })

  if (!current) {
    return send(
      res,
      404,
      null,
      'Result not found.'
    )
  }

  const marks =
    req.body.marks === undefined
      ? current.marks
      : Number(req.body.marks)

  const totalMarks =
    req.body.total_marks === undefined
      ? current.total_marks
      : Number(req.body.total_marks)

  const subject =
    req.body.subject?.trim() ||
    current.subject

  if (marks < 0) {
    return send(
      res,
      422,
      null,
      'Marks cannot be negative.'
    )
  }

  if (marks > totalMarks) {
    return send(
      res,
      422,
      null,
      'Marks cannot be greater than total marks.'
    )
  }

  const duplicate = await db
    .collection(RESULTS)
    .findOne({
      exam_id: current.exam_id,
      student_id: current.student_id,
      subject,
      id: {
        $ne: current.id,
      },
    })

  if (duplicate) {
    return send(
      res,
      409,
      null,
      'Result for this student, exam and subject already exists.'
    )
  }

  await db.collection(RESULTS).updateOne(
    {
      id: current.id,
    },
    {
      $set: {
        subject,
        marks,
        total_marks: totalMarks,
        grade:
          req.body.grade ||
          gradeFor(
            marks,
            totalMarks
          ),
        remark:
          req.body.remark !== undefined
            ? req.body.remark
            : current.remark,
        updated_at:
          new Date().toISOString(),
      },
    }
  )

  const updated = await db
    .collection(RESULTS)
    .findOne({
      id: current.id,
    })

  send(
    res,
    200,
    await buildResult(updated),
    'Result updated successfully.'
  )
})

const remove = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const result = await db
    .collection(RESULTS)
    .deleteOne({
      id: Number(req.params.id),
    })

  if (!result.deletedCount) {
    return send(
      res,
      404,
      null,
      'Result not found.'
    )
  }

  send(
    res,
    200,
    null,
    'Result deleted successfully.'
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
  create,
  update,
  remove,
}