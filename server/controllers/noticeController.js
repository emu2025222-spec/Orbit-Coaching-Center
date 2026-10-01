const { all, get, run } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const select = `SELECT n.*, u.full_name AS created_by_name FROM notices n LEFT JOIN users u ON u.id = n.created_by`

const list = asyncHandler(async (req, res) => {
  let where = ''
  const params = []
  if (req.user.role === 'student') {
    where = ` WHERE n.is_published = 1 AND (n.audience IN ('all', 'students') OR (n.audience = 'batch' AND n.batch = ?))`
    params.push(req.user.batch || '')
  } else if (req.query.published === 'true') where = ' WHERE n.is_published = 1'
  const rows = await all(`${select}${where} ORDER BY n.published_at DESC, n.id DESC`, params)
  send(res, 200, rows)
})

const create = asyncHandler(async (req, res) => {
  const { title, body, audience = 'all', batch, is_published = true, published_at } = req.body
  if (!title || !body) return send(res, 422, null, 'Notice title and content are required.')
  if (audience === 'batch' && !batch) return send(res, 422, null, 'Batch is required for a batch notice.')
  const result = await run(`INSERT INTO notices (title, body, audience, batch, is_published, published_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [title.trim(), body.trim(), audience, batch || null, Number(Boolean(is_published)), published_at || new Date().toISOString(), req.user.id])
  send(res, 201, await get(`${select} WHERE n.id = ?`, [result.id]), 'Notice created successfully.')
})

const update = asyncHandler(async (req, res) => {
  const current = await get('SELECT * FROM notices WHERE id = ?', [req.params.id])
  if (!current) return send(res, 404, null, 'Notice not found.')
  await run(`UPDATE notices SET title = ?, body = ?, audience = ?, batch = ?, is_published = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    req.body.title?.trim() || current.title, req.body.body?.trim() || current.body, req.body.audience || current.audience,
    req.body.batch ?? current.batch, req.body.is_published === undefined ? current.is_published : Number(Boolean(req.body.is_published)),
    req.body.published_at || current.published_at, current.id,
  ])
  send(res, 200, await get(`${select} WHERE n.id = ?`, [current.id]), 'Notice updated successfully.')
})

const remove = asyncHandler(async (req, res) => {
  const result = await run('DELETE FROM notices WHERE id = ?', [req.params.id])
  if (!result.changes) return send(res, 404, null, 'Notice not found.')
  send(res, 200, null, 'Notice deleted successfully.')
})

module.exports = { list, create, update, remove }
