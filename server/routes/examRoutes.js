const router = require('express').Router()
const controller = require('../controllers/examController')
const { protect, allow } = require('../middleware/auth')

router.get('/', protect, controller.list)
router.post('/', protect, allow('admin'), controller.create)
router.patch('/:id', protect, allow('admin'), controller.update)
router.delete('/:id', protect, allow('admin'), controller.remove)

module.exports = router
