const router = require('express').Router()
const controller = require('../controllers/resultController')
const { protect, allow, studentScope } = require('../middleware/auth')

router.get('/', protect, studentScope, controller.list)
router.post('/', protect, allow('admin'), controller.create)
router.patch('/:id', protect, allow('admin'), controller.update)
router.delete('/:id', protect, allow('admin'), controller.remove)

module.exports = router
