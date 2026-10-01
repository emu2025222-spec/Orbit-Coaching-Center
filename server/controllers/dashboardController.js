const { get, all } = require('../config/db')
const { asyncHandler, send } = require('../utils/api')

const adminDashboard = asyncHandler(async (req, res) => {
  const [students, monthly, exam, attendance, upcomingExams, recentStudents, recentNotices] = await Promise.all([
    get('SELECT COUNT(*) AS total FROM students s JOIN users u ON u.id = s.user_id WHERE u.is_active = 1'),
    get(`SELECT COALESCE(SUM(paid_amount), 0) AS collected, COALESCE(SUM(amount - paid_amount), 0) AS outstanding,
      SUM(CASE WHEN status != 'paid' THEN 1 ELSE 0 END) AS due_count FROM monthly_fees`),
    get('SELECT COALESCE(SUM(paid_amount), 0) AS collected, COALESCE(SUM(amount - paid_amount), 0) AS outstanding FROM exam_fees'),
    get(`SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present
      FROM attendance WHERE attendance_date = date('now')`),
    get(`SELECT COUNT(*) AS total FROM exams WHERE exam_date >= date('now') AND status IN ('scheduled', 'ongoing')`),
    all(`SELECT s.id, s.student_code, s.batch, s.photo_path, u.full_name, u.email FROM students s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 6`),
    all(`SELECT id, title, audience, published_at FROM notices WHERE is_published = 1 ORDER BY published_at DESC LIMIT 5`),
  ])
  send(res, 200, { students: students.total, monthly_fees: monthly, exam_fees: exam, today_attendance: { ...attendance, percentage: attendance.total ? Math.round((attendance.present / attendance.total) * 100) : 0 }, upcoming_exams: upcomingExams.total, recent_students: recentStudents, recent_notices: recentNotices })
})

const studentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user.student_id
  const [student, monthlyFees, examFees, attendance, recentResults, seatPlans, notices] = await Promise.all([
    get(`SELECT s.*, u.full_name, u.email FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, [studentId]),
    get('SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid, COALESCE(SUM(amount-paid_amount), 0) AS due FROM monthly_fees WHERE student_id = ?', [studentId]),
    get('SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid, COALESCE(SUM(amount-paid_amount), 0) AS due FROM exam_fees WHERE student_id = ?', [studentId]),
    get(`SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS present FROM attendance WHERE student_id = ?`, [studentId]),
    all(`SELECT r.*, e.title AS exam_title, e.exam_date FROM results r JOIN exams e ON e.id = r.exam_id WHERE r.student_id = ? ORDER BY e.exam_date DESC LIMIT 8`, [studentId]),
    all(`SELECT sp.*, e.title AS exam_title, e.exam_date FROM seat_plans sp JOIN exams e ON e.id = sp.exam_id WHERE sp.student_id = ? ORDER BY e.exam_date DESC`, [studentId]),
    all(`SELECT id, title, body, published_at FROM notices WHERE is_published = 1 AND (audience IN ('all', 'students') OR (audience = 'batch' AND batch = ?)) ORDER BY published_at DESC LIMIT 5`, [req.user.batch || '']),
  ])
  const totalAttendance = Number(attendance.total || 0)
  send(res, 200, { student, monthly_fees: monthlyFees, exam_fees: examFees, attendance: { ...attendance, percentage: totalAttendance ? Math.round((Number(attendance.present || 0) / totalAttendance) * 10000) / 100 : 0 }, recent_results: recentResults, seat_plans: seatPlans, notices })
})

module.exports = { adminDashboard, studentDashboard }
