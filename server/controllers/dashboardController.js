const { getMongoDB } = require('../config/mongodb')
const { asyncHandler, send } = require('../utils/api')

const STUDENTS = 'students'
const USERS = 'users'
const MONTHLY_FEES = 'monthly_fees'
const EXAM_FEES = 'exam_fees'
const ATTENDANCE = 'attendance'
const EXAMS = 'exams'
const RESULTS = 'results'
const SEAT_PLANS = 'seat_plans'
const NOTICES = 'notices'

const adminDashboard = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const [
    studentsTotal,
    monthlyCollected,
    monthlyOutstanding,
    monthlyDueCount,
    examCollected,
    examOutstanding,
    attendanceTotal,
    attendancePresent,
    upcomingExams,
    recentStudents,
    recentNotices,
  ] = await Promise.all([
    // Active students
    db.collection(STUDENTS).countDocuments({
      user_id: {
        $in: await getActiveStudentUserIds(),
      },
    }),

    // Monthly fees - collected
    sumField(
      MONTHLY_FEES,
      'paid_amount'
    ),

    // Monthly fees - outstanding
    sumOutstanding(MONTHLY_FEES),

    // Monthly fees - due count
    db.collection(MONTHLY_FEES).countDocuments({
      status: {
        $ne: 'paid',
      },
    }),

    // Exam fees - collected
    sumField(
      EXAM_FEES,
      'paid_amount'
    ),

    // Exam fees - outstanding
    sumOutstanding(EXAM_FEES),

    // Today's attendance
    db.collection(ATTENDANCE).countDocuments({
      attendance_date:
        getTodayDate(),
    }),

    db.collection(ATTENDANCE).countDocuments({
      attendance_date:
        getTodayDate(),

      status: {
        $in: ['present', 'late'],
      },
    }),

    // Upcoming exams
    db.collection(EXAMS).countDocuments({
      exam_date: {
        $gte: getTodayDate(),
      },

      status: {
        $in: [
          'scheduled',
          'ongoing',
        ],
      },
    }),

    // Recent students
    getRecentStudents(),

    // Recent notices
    db.collection(NOTICES)
      .find({
        is_published: true,
      })
      .sort({
        published_at: -1,
      })
      .limit(5)
      .project({
        id: 1,
        title: 1,
        audience: 1,
        published_at: 1,
      })
      .toArray(),
  ])

  const attendancePercentage =
    attendanceTotal
      ? Math.round(
          (attendancePresent /
            attendanceTotal) *
            100
        )
      : 0

  send(res, 200, {
    students: studentsTotal,

    monthly_fees: {
      collected: monthlyCollected,
      outstanding:
        monthlyOutstanding,
      due_count:
        monthlyDueCount,
    },

    exam_fees: {
      collected: examCollected,
      outstanding:
        examOutstanding,
    },

    today_attendance: {
      total: attendanceTotal,
      present: attendancePresent,
      percentage:
        attendancePercentage,
    },

    upcoming_exams:
      upcomingExams,

    recent_students:
      recentStudents,

    recent_notices:
      recentNotices,
  })
})

const studentDashboard = asyncHandler(async (req, res) => {
  const db = getMongoDB()

  const studentId =
    Number(req.user.student_id)

  const [
    student,
    monthlyFees,
    examFees,
    attendanceTotal,
    attendancePresent,
    recentResults,
    seatPlans,
    notices,
  ] = await Promise.all([
    getStudent(studentId),

    getFeeSummary(
      MONTHLY_FEES,
      studentId
    ),

    getFeeSummary(
      EXAM_FEES,
      studentId
    ),

    db.collection(ATTENDANCE)
      .countDocuments({
        student_id: studentId,
      }),

    db.collection(ATTENDANCE)
      .countDocuments({
        student_id: studentId,
        status: {
          $in: [
            'present',
            'late',
          ],
        },
      }),

    getRecentResults(studentId),

    getStudentSeatPlans(studentId),

    db.collection(NOTICES)
      .find({
        is_published: true,

        $or: [
          {
            audience: {
              $in: [
                'all',
                'students',
              ],
            },
          },
          {
            audience: 'batch',
            batch:
              req.user.batch || '',
          },
        ],
      })
      .sort({
        published_at: -1,
      })
      .limit(5)
      .project({
        id: 1,
        title: 1,
        body: 1,
        published_at: 1,
      })
      .toArray(),
  ])

  const totalAttendance =
    Number(attendanceTotal || 0)

  const percentage =
    totalAttendance
      ? Math.round(
          (Number(
            attendancePresent || 0
          ) /
            totalAttendance) *
            10000
        ) / 100
      : 0

  send(res, 200, {
    student,

    monthly_fees:
      monthlyFees,

    exam_fees:
      examFees,

    attendance: {
      total:
        attendanceTotal,

      present:
        attendancePresent,

      percentage,
    },

    recent_results:
      recentResults,

    seat_plans:
      seatPlans,

    notices,
  })
})

async function getActiveStudentUserIds() {
  const db = getMongoDB()

  const users = await db
    .collection(USERS)
    .find({
      role: 'student',
      is_active: true,
    })
    .project({
      id: 1,
    })
    .toArray()

  return users.map(
    (user) => Number(user.id)
  )
}

async function sumField(
  collectionName,
  field
) {
  const db = getMongoDB()

  const result = await db
    .collection(collectionName)
    .aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $convert: {
                input: `$${field}`,
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ])
    .toArray()

  return result.length
    ? result[0].total
    : 0
}

async function sumOutstanding(
  collectionName
) {
  const db = getMongoDB()

  const result = await db
    .collection(collectionName)
    .aggregate([
      {
        $project: {
          outstanding: {
            $subtract: [
              {
                $convert: {
                  input: '$amount',
                  to: 'double',
                  onError: 0,
                  onNull: 0,
                },
              },
              {
                $convert: {
                  input:
                    '$paid_amount',
                  to: 'double',
                  onError: 0,
                  onNull: 0,
                },
              },
            ],
          },
        },
      },

      {
        $group: {
          _id: null,
          total: {
            $sum: '$outstanding',
          },
        },
      },
    ])
    .toArray()

  return result.length
    ? result[0].total
    : 0
}

async function getRecentStudents() {
  const db = getMongoDB()

  const students = await db
    .collection(STUDENTS)
    .find({})
    .sort({
      id: -1,
    })
    .limit(6)
    .toArray()

  const result = []

  for (const student of students) {
    const user = await db
      .collection(USERS)
      .findOne({
        id: Number(
          student.user_id
        ),
      })

    if (!user) continue

    result.push({
      id: student.id,
      student_code:
        student.student_code,
      batch: student.batch,
      photo_path:
        student.photo_path,
      full_name:
        user.full_name,
      email:
        user.email,
    })
  }

  return result
}

async function getStudent(
  studentId
) {
  const db = getMongoDB()

  const student = await db
    .collection(STUDENTS)
    .findOne({
      id: studentId,
    })

  if (!student) {
    return null
  }

  const user = await db
    .collection(USERS)
    .findOne({
      id: Number(
        student.user_id
      ),
    })

  if (!user) {
    return null
  }

  return {
    ...student,
    full_name:
      user.full_name,
    email:
      user.email,
  }
}

async function getFeeSummary(
  collectionName,
  studentId
) {
  const db = getMongoDB()

  const result = await db
    .collection(collectionName)
    .aggregate([
      {
        $match: {
          student_id: studentId,
        },
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: {
              $convert: {
                input: '$amount',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },

          paid: {
            $sum: {
              $convert: {
                input:
                  '$paid_amount',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },

      {
        $project: {
          _id: 0,
          total: 1,
          paid: 1,
          due: {
            $subtract: [
              '$total',
              '$paid',
            ],
          },
        },
      },
    ])
    .toArray()

  return result.length
    ? result[0]
    : {
        total: 0,
        paid: 0,
        due: 0,
      }
}

async function getRecentResults(
  studentId
) {
  const db = getMongoDB()

  const results = await db
    .collection(RESULTS)
    .find({
      student_id: studentId,
    })
    .sort({
      exam_id: -1,
    })
    .limit(8)
    .toArray()

  const output = []

  for (const result of results) {
    const exam = await db
      .collection(EXAMS)
      .findOne({
        id: Number(
          result.exam_id
        ),
      })

    output.push({
      ...result,
      exam_title:
        exam?.title || null,
      exam_date:
        exam?.exam_date || null,
    })
  }

  return output
}

async function getStudentSeatPlans(
  studentId
) {
  const db = getMongoDB()

  const plans = await db
    .collection(SEAT_PLANS)
    .find({
      student_id: studentId,
    })
    .toArray()

  const output = []

  for (const plan of plans) {
    const exam = await db
      .collection(EXAMS)
      .findOne({
        id: Number(
          plan.exam_id
        ),
      })

    if (!exam) continue

    output.push({
      ...plan,
      exam_title:
        exam.title,
      exam_date:
        exam.exam_date,
    })
  }

  output.sort((a, b) =>
    String(
      b.exam_date || ''
    ).localeCompare(
      String(
        a.exam_date || ''
      )
    )
  )

  return output
}

function getTodayDate() {
  const now = new Date()

  const year =
    now.getFullYear()

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0')

  const day =
    String(
      now.getDate()
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

module.exports = {
  adminDashboard,
  studentDashboard,
}