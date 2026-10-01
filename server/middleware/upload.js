const path = require('path')
const multer = require('multer')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'students'),
  filename: (req, file, callback) => callback(null, `student-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
})

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) return callback(new Error('Only image files are allowed.'))
    callback(null, true)
  },
})

module.exports = upload
