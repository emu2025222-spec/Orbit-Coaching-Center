const bcrypt = require('bcryptjs')
const { ObjectId } = require('mongodb')
const { getMongoDB, client } = require('../config/mongodb')
const { asyncHandler, send, pagination } = require('../utils/api')

const USERS = 'users'
const STUDENTS = 'students'

async function getNextId(collectionName) {
  const db = getMongoDB()

  const last = await db
    .collection(collectionName)
    .find({})
    .sort({ id: -1 })
    .limit(1)
    .next()

  return last ? Number(last.id) + 1 : 1
}

async function buildStudent(student) {
  if (!student) return null

  const db = getMongoDB()

  const user = await db.collection(USERS).findOne({
    id: Number(student.user_id),
  })

  if (!user) return null

  return {
    id: student.id,
    student_code: student.student_code,
    phone: student.phone || null,
    guardian_name: student.guardian_name || null,
    guardian_phone: student.guardian_phone || null,
    batch: student.batch || null,
    address: student.address || null,
    date_of_birth: student.date_of_birth || null,
    photo_path: student.photo_path || null,
    enrolled_at: student.enrolled_at,
    user_id: user.id,
    email: user.email,
    full_name: user.full_name,
    is_active: user.is_active,
  }
}

const list = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const { page, limit, offset } = pagination(req.query)

  const filters = {}

  if (req.query.search) {
    const search = req.query.search.trim()

    if (search) {
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      )

      const users = await db.collection(USERS)
        .find({
          role: 'student',
          $or: [
            { full_name: regex },
            { email: regex },
          ],
        })
        .project({ id: 1 })
        .toArray()

      const students = await db.collection(STUDENTS)
        .find({
          $or: [
            { student_code: regex },
            { phone: regex },
          ],
        })
        .project({ id: 1 })
        .toArray()

      const userIds = users.map(item => item.id)
      const studentIds = students.map(item => item.id)

      const matchingStudents = await db.collection(STUDENTS)
        .find({
          $or: [
            { user_id: { $in: userIds } },
            { id: { $in: studentIds } },
          ],
        })
        .project({ id: 1 })
        .toArray()

      filters.id = {
        $in: matchingStudents.map(item => item.id),
      }
    }
  }

  if (req.query.batch) {
    filters.batch = req.query.batch
  }

  if (req.query.active) {
    const activeValue = req.query.active === 'true'

    const activeUsers = await db.collection(USERS)
      .find({
        role: 'student',
        is_active: activeValue,
      })
      .project({ id: 1 })
      .toArray()

    filters.user_id = {
      $in: activeUsers.map(item => item.id),
    }
  }

  const total = await db
    .collection(STUDENTS)
    .countDocuments(filters)

  const studentRows = await db
    .collection(STUDENTS)
    .find(filters)
    .sort({ id: -1 })
    .skip(offset)
    .limit(limit)
    .toArray()

  const rows = []

  for (const student of studentRows) {
    const row = await buildStudent(student)

    if (row) {
      rows.push(row)
    }
  }

  send(res, 200, {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
})

const getOne = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(req.params.id),
  })

  if (!student) {
    return send(res, 404, null, 'Student not found.')
  }

  const result = await buildStudent(student)

  if (!result) {
    return send(res, 404, null, 'Student not found.')
  }

  send(res, 200, result)
})

const getMine = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(req.user.student_id),
  })

  if (!student) {
    return send(res, 404, null, 'Student profile not found.')
  }

  const result = await buildStudent(student)

  if (!result) {
    return send(res, 404, null, 'Student profile not found.')
  }

  send(res, 200, result)
})

const create = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    full_name,
    email,
    password,
    student_code,
    phone,
    guardian_name,
    guardian_phone,
    batch,
    address,
    date_of_birth,
  } = req.body

  if (!full_name || !email || !password || !student_code) {
    return send(
      res,
      422,
      null,
      'Full name, email, password and student code are required.'
    )
  }

  if (password.length < 8) {
    return send(
      res,
      422,
      null,
      'Student password must be at least 8 characters.'
    )
  }

  const cleanEmail = email.trim()
  const cleanStudentCode = student_code.trim()

  const emailRegex = new RegExp(
    `^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i'
  )

  const studentCodeRegex = new RegExp(
    `^${cleanStudentCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i'
  )

  const existingUser = await db.collection(USERS).findOne({
    email: emailRegex,
  })

  const existingStudent = await db.collection(STUDENTS).findOne({
    student_code: studentCodeRegex,
  })

  if (existingUser || existingStudent) {
    return send(
      res,
      409,
      null,
      'Email or student code already exists.'
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const userId = await getNextId(USERS)
  const studentId = await getNextId(STUDENTS)

  const now = new Date().toISOString()

  const photoPath = req.file
    ? `/uploads/students/${req.file.filename}`
    : null

  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      await db.collection(USERS).insertOne(
        {
          _id: new ObjectId(),
          id: userId,
          email: cleanEmail,
          full_name: full_name.trim(),
          password_hash: passwordHash,
          role: 'student',
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        { session }
      )

      await db.collection(STUDENTS).insertOne(
        {
          _id: new ObjectId(),
          id: studentId,
          user_id: userId,
          student_code: cleanStudentCode,
          phone: phone || null,
          guardian_name: guardian_name || null,
          guardian_phone: guardian_phone || null,
          batch: batch || null,
          address: address || null,
          date_of_birth: date_of_birth || null,
          photo_path: photoPath,
          enrolled_at: now,
        },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }

  const created = await buildStudent(
    await db.collection(STUDENTS).findOne({
      id: studentId,
    })
  )

  send(res, 201, created, 'Student created successfully.')
})

const update = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db.collection(STUDENTS).findOne({
    id: Number(req.params.id),
  })

  if (!current) {
    return send(res, 404, null, 'Student not found.')
  }

  const currentUser = await db.collection(USERS).findOne({
    id: Number(current.user_id),
  })

  if (!currentUser) {
    return send(res, 404, null, 'Student user account not found.')
  }

  const body = req.body

  if (
    body.email &&
    body.email.trim().toLowerCase() !== currentUser.email.toLowerCase()
  ) {
    const emailRegex = new RegExp(
      `^${body.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    )

    const duplicate = await db.collection(USERS).findOne({
      email: emailRegex,
      id: { $ne: currentUser.id },
    })

    if (duplicate) {
      return send(res, 409, null, 'Email already exists.')
    }
  }

  if (
    body.student_code &&
    body.student_code.trim().toLowerCase() !==
      current.student_code.toLowerCase()
  ) {
    const studentCodeRegex = new RegExp(
      `^${body.student_code.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    )

    const duplicate = await db.collection(STUDENTS).findOne({
      student_code: studentCodeRegex,
      id: { $ne: current.id },
    })

    if (duplicate) {
      return send(res, 409, null, 'Student code already exists.')
    }
  }

  let passwordHash = null

  if (body.password) {
    if (body.password.length < 8) {
      return send(
        res,
        422,
        null,
        'Student password must be at least 8 characters.'
      )
    }

    passwordHash = await bcrypt.hash(body.password, 12)
  }

  const now = new Date().toISOString()

  const userUpdate = {
    full_name: body.full_name?.trim() || currentUser.full_name,
    email: body.email?.trim() || currentUser.email,
    is_active:
      body.is_active === undefined
        ? currentUser.is_active
        : Boolean(body.is_active),
    updated_at: now,
  }

  if (passwordHash) {
    userUpdate.password_hash = passwordHash
  }

  await db.collection(USERS).updateOne(
    { id: currentUser.id },
    {
      $set: userUpdate,
    }
  )

  const photoPath = req.file
    ? `/uploads/students/${req.file.filename}`
    : current.photo_path || null

  await db.collection(STUDENTS).updateOne(
    { id: current.id },
    {
      $set: {
        student_code:
          body.student_code?.trim() || current.student_code,

        phone:
          body.phone !== undefined
            ? body.phone
            : current.phone,

        guardian_name:
          body.guardian_name !== undefined
            ? body.guardian_name
            : current.guardian_name,

        guardian_phone:
          body.guardian_phone !== undefined
            ? body.guardian_phone
            : current.guardian_phone,

        batch:
          body.batch !== undefined
            ? body.batch
            : current.batch,

        address:
          body.address !== undefined
            ? body.address
            : current.address,

        date_of_birth:
          body.date_of_birth !== undefined
            ? body.date_of_birth
            : current.date_of_birth,

        photo_path: photoPath,
      },
    }
  )

  const updated = await buildStudent(
    await db.collection(STUDENTS).findOne({
      id: current.id,
    })
  )

  send(res, 200, updated, 'Student updated successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const student = await db.collection(STUDENTS).findOne({
    id: Number(req.params.id),
  })

  if (!student) {
    return send(res, 404, null, 'Student not found.')
  }

  await db.collection(STUDENTS).deleteOne({
    id: student.id,
  })

  await db.collection(USERS).deleteOne({
    id: student.user_id,
  })

  send(res, 200, null, 'Student deleted successfully.')
})

module.exports = {
  list,
  getOne,
  getMine,
  create,
  update,
  remove,
}