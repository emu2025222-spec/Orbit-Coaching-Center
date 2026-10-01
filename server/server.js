require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const initializeDatabase = require('./database/init')

const app = express()
const PORT = Number(process.env.PORT || 5000)

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Orbit Coaching Center API is running.' }))
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/students', require('./routes/studentRoutes'))
app.use('/api/fees', require('./routes/feeRoutes'))
app.use('/api/attendance', require('./routes/attendanceRoutes'))
app.use('/api/results', require('./routes/resultRoutes'))
app.use('/api/exams', require('./routes/examRoutes'))
app.use('/api/seat-plans', require('./routes/seatPlanRoutes'))
app.use('/api/notices', require('./routes/noticeRoutes'))
app.use('/api/dashboard', require('./routes/dashboardRoutes'))

app.use((req, res) => res.status(404).json({ success: false, message: 'API route not found.' }))
app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Photo must be smaller than 4 MB.' })
  if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: 'This data conflicts with an existing record.' })
  console.error(error)
  return res.status(500).json({ success: false, message: error.message || 'An unexpected server error occurred.' })
})

initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`Orbit API listening on http://localhost:${PORT}`)))
  .catch((error) => {
    console.error('Database initialization failed:', error)
    process.exit(1)
  })
