const router = require('express').Router()
const controller = require('../controllers/seatPlanController')
const { protect, allow } = require('../middleware/auth')

router.get('/', protect, controller.list)
router.post('/', protect, allow('admin'), controller.save)
router.delete('/:id', protect, allow('admin'), controller.remove)

module.exports = router
