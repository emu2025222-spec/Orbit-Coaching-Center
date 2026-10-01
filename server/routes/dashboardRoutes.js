const router = require('express').Router()
const { adminDashboard, studentDashboard } = require('../controllers/dashboardController')
const { protect, allow } = require('../middleware/auth')

router.get('/admin', protect, allow('admin'), adminDashboard)
router.get('/student', protect, allow('student'), studentDashboard)

module.exports = router
