const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const EXAMS = 'exams'
const RESULTS = 'results'

const list = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const filters = {}

  if (req.user.role === 'student') {
    filters.$or = [
      { batch: null },
      { batch: '' },
      { batch: req.user.batch || '' },
    ]
  }

  if (req.query.status) {
    filters.status = req.query.status
  }

  const exams = await db
    .collection(EXAMS)
    .find(filters)
    .sort({
      exam_date: -1,
    })
    .toArray()

  const result = []

  for (const exam of exams) {
    const resultCount = await db
      .collection(RESULTS)
      .countDocuments({
        exam_id: Number(exam.id),
      })

    result.push({
      ...exam,
      result_count: resultCount,
    })
  }

  send(res, 200, result)
})

const create = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    title,
    exam_date,
    batch,
    total_marks = 100,
    room,
    status = 'scheduled',
  } = req.body

  if (!title || !exam_date) {
    return send(
      res,
      422,
      null,
      'Exam title and date are required.'
    )
  }

  const validStatuses = [
    'scheduled',
    'ongoing',
    'published',
    'completed',
  ]

  if (!validStatuses.includes(status)) {
    return send(
      res,
      422,
      null,
      'Invalid exam status.'
    )
  }

  const numericTotalMarks = Number(total_marks)

  if (
    !Number.isFinite(numericTotalMarks) ||
    numericTotalMarks <= 0
  ) {
    return send(
      res,
      422,
      null,
      'Total marks must be greater than 0.'
    )
  }

  const now = new Date().toISOString()
  const nextId = await getNextId(EXAMS)

  await db.collection(EXAMS).insertOne({
    id: nextId,
    title: title.trim(),
    exam_date,
    batch: batch || null,
    total_marks: numericTotalMarks,
    room: room || null,
    status,
    created_by: req.user.id,
    created_at: now,
    updated_at: now,
  })

  const created = await db
    .collection(EXAMS)
    .findOne({
      id: nextId,
    })

  send(
    res,
    201,
    created,
    'Exam created successfully.'
  )
})

const update = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db
    .collection(EXAMS)
    .findOne({
      id: Number(req.params.id),
    })

  if (!current) {
    return send(
      res,
      404,
      null,
      'Exam not found.'
    )
  }

  const totalMarks =
    req.body.total_marks === undefined
      ? current.total_marks
      : Number(req.body.total_marks)

  if (
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0
  ) {
    return send(
      res,
      422,
      null,
      'Total marks must be greater than 0.'
    )
  }

  const validStatuses = [
    'scheduled',
    'ongoing',
    'published',
    'completed',
  ]

  const status =
    req.body.status ||
    current.status

  if (!validStatuses.includes(status)) {
    return send(
      res,
      422,
      null,
      'Invalid exam status.'
    )
  }

  await db.collection(EXAMS).updateOne(
    {
      id: current.id,
    },
    {
      $set: {
        title:
          req.body.title?.trim() ||
          current.title,

        exam_date:
          req.body.exam_date ||
          current.exam_date,

        batch:
          req.body.batch !== undefined
            ? req.body.batch
            : current.batch,

        total_marks: totalMarks,

        room:
          req.body.room !== undefined
            ? req.body.room
            : current.room,

        status,

        updated_at:
          new Date().toISOString(),
      },
    }
  )

  const updated = await db
    .collection(EXAMS)
    .findOne({
      id: current.id,
    })

  send(
    res,
    200,
    updated,
    'Exam updated successfully.'
  )
})

const remove = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const exam = await db
    .collection(EXAMS)
    .findOne({
      id: Number(req.params.id),
    })

  if (!exam) {
    return send(
      res,
      404,
      null,
      'Exam not found.'
    )
  }

  // Remove results connected to this exam.
  await db.collection(RESULTS).deleteMany({
    exam_id: exam.id,
  })

  await db.collection(EXAMS).deleteOne({
    id: exam.id,
  })

  send(
    res,
    200,
    null,
    'Exam deleted successfully.'
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