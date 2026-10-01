const router = require('express').Router()
const controller = require('../controllers/feeController')
const { protect, allow, studentScope } = require('../middleware/auth')

router.get('/monthly', protect, studentScope, controller.listMonthly)
router.post('/monthly', protect, allow('admin'), controller.createMonthly)
router.patch('/monthly/:id', protect, allow('admin'), controller.updateMonthly)
router.delete('/monthly/:id', protect, allow('admin'), controller.removeMonthly)
router.get('/exam', protect, studentScope, controller.listExam)
router.post('/exam', protect, allow('admin'), controller.createExam)
router.patch('/exam/:id', protect, allow('admin'), controller.updateExam)
router.delete('/exam/:id', protect, allow('admin'), controller.removeExam)

module.exports = router
