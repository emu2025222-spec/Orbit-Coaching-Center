const router = require('express').Router()
const controller = require('../controllers/studentController')
const { protect, allow } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/me', protect, allow('student'), controller.getMine)
router.get('/', protect, allow('admin'), controller.list)
router.post('/', protect, allow('admin'), upload.single('photo'), controller.create)
router.get('/:id', protect, allow('admin'), controller.getOne)
router.patch('/:id', protect, allow('admin'), upload.single('photo'), controller.update)
router.delete('/:id', protect, allow('admin'), controller.remove)

module.exports = router
