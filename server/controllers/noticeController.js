const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const NOTICES = 'notices'
const USERS = 'users'

async function buildNotice(notice) {
  if (!notice) return null

  const db = getMongoDB()

  let createdByName = null

  if (notice.created_by) {
    const user = await db.collection(USERS).findOne({
      id: Number(notice.created_by),
    })

    if (user) {
      createdByName = user.full_name
    }
  }

  return {
    ...notice,
    created_by_name: createdByName,
  }
}

const list = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const filters = {}

  if (req.user.role === 'student') {
    filters.is_published = true

    filters.$or = [
      {
        audience: {
          $in: ['all', 'students'],
        },
      },
      {
        audience: 'batch',
        batch: req.user.batch || '',
      },
    ]
  } else if (req.query.published === 'true') {
    filters.is_published = true
  }

  const notices = await db
    .collection(NOTICES)
    .find(filters)
    .sort({
      published_at: -1,
      id: -1,
    })
    .toArray()

  const rows = []

  for (const notice of notices) {
    const row = await buildNotice(notice)

    if (row) {
      rows.push(row)
    }
  }

  send(res, 200, rows)
})

const create = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const {
    title,
    body,
    audience = 'all',
    batch,
    is_published = true,
    published_at,
  } = req.body

  if (!title || !body) {
    return send(
      res,
      422,
      null,
      'Notice title and content are required.'
    )
  }

  const validAudiences = [
    'all',
    'students',
    'admins',
    'batch',
  ]

  if (!validAudiences.includes(audience)) {
    return send(
      res,
      422,
      null,
      'Invalid notice audience.'
    )
  }

  if (audience === 'batch' && !batch) {
    return send(
      res,
      422,
      null,
      'Batch is required for a batch notice.'
    )
  }

  const now = new Date().toISOString()
  const nextId = await getNextId(NOTICES)

  const notice = {
    id: nextId,
    title: title.trim(),
    body: body.trim(),
    audience,
    batch: batch || null,
    is_published: Boolean(is_published),
    published_at:
      published_at || now,
    created_by: req.user.id,
    created_at: now,
    updated_at: now,
  }

  await db.collection(NOTICES).insertOne(notice)

  const created = await buildNotice(notice)

  send(
    res,
    201,
    created,
    'Notice created successfully.'
  )
})

const update = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const current = await db
    .collection(NOTICES)
    .findOne({
      id: Number(req.params.id),
    })

  if (!current) {
    return send(
      res,
      404,
      null,
      'Notice not found.'
    )
  }

  const audience =
    req.body.audience ||
    current.audience

  const batch =
    req.body.batch !== undefined
      ? req.body.batch
      : current.batch

  const isPublished =
    req.body.is_published === undefined
      ? current.is_published
      : Boolean(req.body.is_published)

  const validAudiences = [
    'all',
    'students',
    'admins',
    'batch',
  ]

  if (!validAudiences.includes(audience)) {
    return send(
      res,
      422,
      null,
      'Invalid notice audience.'
    )
  }

  if (audience === 'batch' && !batch) {
    return send(
      res,
      422,
      null,
      'Batch is required for a batch notice.'
    )
  }

  const updatedAt =
    new Date().toISOString()

  await db.collection(NOTICES).updateOne(
    {
      id: current.id,
    },
    {
      $set: {
        title:
          req.body.title?.trim() ||
          current.title,

        body:
          req.body.body?.trim() ||
          current.body,

        audience,

        batch: batch || null,

        is_published: isPublished,

        published_at:
          req.body.published_at ||
          current.published_at,

        updated_at: updatedAt,
      },
    }
  )

  const updated = await buildNotice(
    await db.collection(NOTICES).findOne({
      id: current.id,
    })
  )

  send(
    res,
    200,
    updated,
    'Notice updated successfully.'
  )
})

const remove = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const result = await db
    .collection(NOTICES)
    .deleteOne({
      id: Number(req.params.id),
    })

  if (!result.deletedCount) {
    return send(
      res,
      404,
      null,
      'Notice not found.'
    )
  }

  send(
    res,
    200,
    null,
    'Notice deleted successfully.'
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