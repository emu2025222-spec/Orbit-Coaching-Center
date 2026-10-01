const router = require('express').Router()
const controller = require('../controllers/attendanceController')
const { protect, allow, studentScope } = require('../middleware/auth')

router.get('/', protect, studentScope, controller.list)
router.get('/summary', protect, controller.summary)
router.post('/', protect, allow('admin'), controller.mark)

module.exports = router
