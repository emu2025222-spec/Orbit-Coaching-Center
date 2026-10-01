import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage, serverBaseUrl, setAccessToken } from './api'
import './App.css'

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const money = (value) => `৳ ${Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const dateText = (value) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const initial = (name = '') => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'OC'

function useRequest(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const response = await loader()
      setState({ loading: false, error: '', data: response.data.data })
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error), data: null })
    }
  }, dependencies)
  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}

function App() {
  const [auth, setAuth] = useState(null)
  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    setAccessToken(response.data.data.token)
    setAuth(response.data.data)
  }
  const logout = () => { setAccessToken(null); setAuth(null) }
  return auth ? <Portal auth={auth} onLogout={logout} /> : <Login onLogin={login} />
}

function Login({ onLogin }) {
  const [role, setRole] = useState('admin')
  const [form, setForm] = useState({ login: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try { await onLogin({ ...form, role }) } catch (requestError) { setError(getErrorMessage(requestError)) } finally { setBusy(false) }
  }
  return <main className="login-shell">
    <section className="login-intro"><div className="brand brand-light"><span className="brand-orbit">◉</span><div><b>ORBIT</b><small>COACHING CENTER</small></div></div><div className="intro-copy"><p>SMART EDUCATION PORTAL</p><h1>One place for every<br /><strong>academic detail.</strong></h1><span>Securely manage students, fees, attendance, results, seat plans, and notices.</span></div><div className="planet-art"><i /><b>✦</b><em>✦</em></div><small className="login-copyright">© 2026 Orbit Coaching Center</small></section>
    <section className="login-card-wrap"><div className="login-card"><div className="brand mobile-brand"><span className="brand-orbit">◉</span><div><b>ORBIT</b><small>COACHING CENTER</small></div></div><p className="caption">WELCOME BACK</p><h2>Sign in to your portal</h2><p className="muted">Use the credentials created for your account.</p><div className="role-switch"><button type="button" className={role === 'admin' ? 'selected' : ''} onClick={() => setRole('admin')}>Administrator <small>Manage the centre</small></button><button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}>Student <small>View your records</small></button></div><form onSubmit={submit} className="login-form"><label>Email or Student ID<input required value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} placeholder={role === 'admin' ? 'admin@orbit.local' : 'OCC-2026-001'} autoComplete="username" /></label><label>Password<input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" autoComplete="current-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <span>→</span></button></form><p className="login-note">The initial administrator is created from the backend <code>.env</code> file on first run.</p></div></section>
  </main>
}

function Portal({ auth, onLogout }) {
  const { user } = auth
  const [active, setActive] = useState('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const adminItems = [['dashboard', 'Overview'], ['students', 'Students'], ['monthly-fees', 'Monthly fees'], ['exam-fees', 'Exam fees'], ['attendance', 'Attendance'], ['exams', 'Exams'], ['results', 'Results'], ['seat-plans', 'Seat plans'], ['notices', 'Notices']]
  const studentItems = [['dashboard', 'Overview'], ['profile', 'My profile'], ['monthly-fees', 'Monthly fees'], ['exam-fees', 'Exam fees'], ['attendance', 'Attendance'], ['results', 'Results'], ['seat-plans', 'Seat plan'], ['notices', 'Notices']]
  const items = user.role === 'admin' ? adminItems : studentItems
  const navigate = (next) => { setActive(next); setMobileNav(false) }
  return <div className="portal"><aside className={`side-nav ${mobileNav ? 'open' : ''}`}><div className="brand"><span className="brand-orbit">◉</span><div><b>ORBIT</b><small>COACHING CENTER</small></div></div><p className="menu-label">{user.role === 'admin' ? 'ADMINISTRATION' : 'STUDENT PORTAL'}</p><nav>{items.map(([id, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}><span className="nav-glyph">{navIcon(id)}</span>{label}</button>)}</nav><div className="nav-foot"><div className="support"><span>?</span><p><b>Need support?</b><small>Contact Orbit Office</small></p></div><button className="logout" onClick={onLogout}><span className="nav-glyph">↪</span> Sign out</button></div></aside><div className={`nav-mask ${mobileNav ? 'visible' : ''}`} onClick={() => setMobileNav(false)} /><main className="portal-main"><header className="top-bar"><button className="menu-toggle" onClick={() => setMobileNav(true)}>☰</button><div className="top-title"><span>Orbit Coaching Center</span><small>{user.role === 'admin' ? 'Administration portal' : 'Student portal'}</small></div><div className="user-chip">{user.photo_path ? <img src={`${serverBaseUrl}${user.photo_path}`} alt="" /> : <span>{initial(user.full_name)}</span>}<div><b>{user.full_name}</b><small>{user.role === 'admin' ? 'Administrator' : user.student_code}</small></div></div></header><section className="page-content"><Page active={active} user={user} /></section></main></div>
}

function Page({ active, user }) {
  const role = user.role
  if (active === 'dashboard') return role === 'admin' ? <AdminDashboard /> : <StudentDashboard />
  if (active === 'profile') return <ProfilePage />
  if (active === 'students') return <StudentsPage />
  if (active === 'monthly-fees') return <FeesPage type="monthly" role={role} />
  if (active === 'exam-fees') return <FeesPage type="exam" role={role} />
  if (active === 'attendance') return <AttendancePage role={role} />
  if (active === 'exams') return <ExamsPage role={role} />
  if (active === 'results') return <ResultsPage role={role} />
  if (active === 'seat-plans') return <SeatPlansPage role={role} />
  if (active === 'notices') return <NoticesPage role={role} />
  return null
}

function Header({ eyebrow, title, children }) { return <div className="page-header"><div><p className="caption">{eyebrow}</p><h1>{title}</h1></div>{children}</div> }
function Loading({ text = 'Loading records…' }) { return <div className="loading">{text}</div> }
function ErrorBox({ message, retry }) { return <div className="error-box"><span>{message}</span>{retry && <button onClick={retry}>Try again</button>}</div> }
function Empty({ text = 'No records found.' }) { return <div className="empty">{text}</div> }
function Metric({ label, value, note, tone = 'purple' }) { return <article className={`metric ${tone}`}><span className="metric-mark">{tone === 'green' ? '↗' : tone === 'orange' ? '৳' : tone === 'red' ? '!' : '◌'}</span><div><small>{label}</small><b>{value}</b>{note && <em>{note}</em>}</div></article> }
function Status({ value }) { return <span className={`status ${String(value).toLowerCase()}`}>{String(value || 'due').replace('_', ' ')}</span> }

function AdminDashboard() {
  const { data, loading, error, reload } = useRequest(() => api.get('/dashboard/admin'), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} retry={reload} />
  return <><Header eyebrow="CENTRE OVERVIEW" title="Administration dashboard" /><section className="metric-grid"><Metric label="Active students" value={data.students} note="Registered students" /><Metric tone="green" label="Monthly fee collected" value={money(data.monthly_fees.collected)} note={`${data.monthly_fees.due_count || 0} due account(s)`} /><Metric tone="orange" label="Exam fee collected" value={money(data.exam_fees.collected)} note={`Outstanding ${money(data.exam_fees.outstanding)}`} /><Metric tone="red" label="Today's attendance" value={`${data.today_attendance.percentage}%`} note={`${data.today_attendance.present || 0}/${data.today_attendance.total || 0} marked`} /></section><div className="two-column"><section className="panel"><PanelTitle title="Recently enrolled students" /><DataTable headers={['Student', 'Code', 'Batch']} rows={data.recent_students.map((student) => [<Person key="person" person={student} />, student.student_code, student.batch || '—'])} empty="No students have been enrolled yet." /></section><section className="panel"><PanelTitle title="Latest notices" /><div className="compact-list">{data.recent_notices.length ? data.recent_notices.map((notice) => <div key={notice.id}><span className="notice-icon">✦</span><p><b>{notice.title}</b><small>{dateText(notice.published_at)} · {notice.audience}</small></p></div>) : <Empty text="No published notices." />}</div></section></div></>
}

function StudentDashboard() {
  const { data, loading, error, reload } = useRequest(() => api.get('/dashboard/student'), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} retry={reload} />
  return <><Header eyebrow="MY OVERVIEW" title={`Welcome, ${data.student.full_name.split(' ')[0]}`} /><section className="metric-grid"><Metric label="Monthly fee due" value={money(data.monthly_fees.due)} note={`Paid ${money(data.monthly_fees.paid)}`} /><Metric tone="orange" label="Exam fee due" value={money(data.exam_fees.due)} note={`Paid ${money(data.exam_fees.paid)}`} /><Metric tone="green" label="Attendance" value={`${data.attendance.percentage}%`} note={`${data.attendance.present || 0}/${data.attendance.total || 0} classes`} /><Metric tone="purple" label="Seat assignments" value={data.seat_plans.length} note="Upcoming exams" /></section><div className="two-column"><section className="panel"><PanelTitle title="Latest results" /><DataTable headers={['Exam', 'Subject', 'Score', 'Grade']} rows={data.recent_results.map((result) => [result.exam_title, result.subject, `${result.marks}/${result.total_marks}`, <Status key="status" value={result.grade || 'pending'} />])} empty="No results published yet." /></section><section className="panel"><PanelTitle title="Notices for you" /><div className="compact-list">{data.notices.length ? data.notices.map((notice) => <div key={notice.id}><span className="notice-icon">✦</span><p><b>{notice.title}</b><small>{dateText(notice.published_at)}</small></p></div>) : <Empty text="No notices published yet." />}</div></section></div></>
}

function ProfilePage() {
  const { data, loading, error, reload } = useRequest(() => api.get('/students/me'), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} retry={reload} />
  return <><Header eyebrow="STUDENT PROFILE" title="My profile" /><section className="profile-card"><div className="profile-photo">{data.photo_path ? <img src={`${serverBaseUrl}${data.photo_path}`} alt={data.full_name} /> : initial(data.full_name)}</div><div className="profile-head"><h2>{data.full_name}</h2><p>{data.student_code} · {data.batch || 'No batch assigned'}</p></div><dl><Info label="Email" value={data.email} /><Info label="Phone" value={data.phone} /><Info label="Guardian" value={data.guardian_name} /><Info label="Guardian phone" value={data.guardian_phone} /><Info label="Date of birth" value={dateText(data.date_of_birth)} /><Info label="Address" value={data.address} /></dl></section></>
}

function StudentsPage() {
  const [query, setQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error, reload } = useRequest(() => api.get('/students', { params: { limit: 100, search: query || undefined } }), [query, refreshKey])
  const [form, setForm] = useState(null)
  const remove = async (student) => { if (!window.confirm(`Delete ${student.full_name}? This cannot be undone.`)) return; try { await api.delete(`/students/${student.id}`); setRefreshKey((key) => key + 1) } catch (requestError) { window.alert(getErrorMessage(requestError)) } }
  return <><Header eyebrow="STUDENT MANAGEMENT" title="Students"><button className="primary" onClick={() => setForm({})}>+ Add student</button></Header><div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, phone, or student ID" /><span>{data?.pagination?.total || 0} total</span></div>{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <section className="panel table-panel"><DataTable headers={['Student', 'Student ID', 'Batch', 'Phone', 'Status', '']} rows={data.rows.map((student) => [<Person key="person" person={student} />, student.student_code, student.batch || '—', student.phone || '—', <Status key="status" value={student.is_active ? 'active' : 'inactive'} />, <div className="row-actions" key="actions"><button onClick={() => setForm(student)}>Edit</button><button className="danger-link" onClick={() => remove(student)}>Delete</button></div>])} empty="No students match this search." /></section>}{form && <StudentModal student={form.id ? form : null} onClose={() => setForm(null)} onDone={() => { setForm(null); setRefreshKey((key) => key + 1) }} />}</>
}

function StudentModal({ student, onClose, onDone }) {
  const [form, setForm] = useState({ full_name: student?.full_name || '', email: student?.email || '', password: '', student_code: student?.student_code || '', phone: student?.phone || '', guardian_name: student?.guardian_name || '', guardian_phone: student?.guardian_phone || '', batch: student?.batch || '', address: student?.address || '', date_of_birth: student?.date_of_birth || '', is_active: student?.is_active ?? true })
  const [photo, setPhoto] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); const payload = new FormData(); Object.entries(form).forEach(([key, value]) => { if (value !== '' && value !== null) payload.append(key, value) }); if (photo) payload.append('photo', photo); try { if (student) await api.patch(`/students/${student.id}`, payload); else await api.post('/students', payload); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } finally { setBusy(false) } }
  return <Modal title={student ? 'Edit student' : 'Add new student'} onClose={onClose}><form onSubmit={submit} className="form-grid"><Field label="Full name" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} required /><Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required /><Field label={student ? 'New password (optional)' : 'Password'} type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required={!student} /><Field label="Student code" value={form.student_code} onChange={(value) => setForm({ ...form, student_code: value })} required /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Batch" value={form.batch} onChange={(value) => setForm({ ...form, batch: value })} /><Field label="Guardian name" value={form.guardian_name} onChange={(value) => setForm({ ...form, guardian_name: value })} /><Field label="Guardian phone" value={form.guardian_phone} onChange={(value) => setForm({ ...form, guardian_phone: value })} /><Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(value) => setForm({ ...form, date_of_birth: value })} /><label>Student photo<input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label><label className="full">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>{student && <label className="check full"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active account</label>}{error && <p className="form-error full">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Save student'}</button></form></Modal>
}

function FeesPage({ type, role }) {
  const endpoint = type === 'monthly' ? '/fees/monthly' : '/fees/exam'
  const [refreshKey, setRefreshKey] = useState(0); const [showForm, setShowForm] = useState(false)
  const { data: fees, loading, error, reload } = useRequest(() => api.get(endpoint), [endpoint, refreshKey])
  const { data: students } = useRequest(() => role === 'admin' ? api.get('/students', { params: { limit: 100 } }) : Promise.resolve({ data: { data: { rows: [] } } }), [role])
  const remove = async (fee) => { if (!window.confirm('Delete this fee record?')) return; try { await api.delete(`${endpoint}/${fee.id}`); setRefreshKey((key) => key + 1) } catch (requestError) { window.alert(getErrorMessage(requestError)) } }
  const title = type === 'monthly' ? 'Monthly fee management' : 'Exam fee management'
  return <><Header eyebrow="FINANCE" title={title}>{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}>+ Add fee</button>}</Header>{role === 'admin' && <section className="metric-grid small-metrics"><Metric label="Collected" tone="green" value={money((fees || []).reduce((sum, fee) => sum + Number(fee.paid_amount), 0))} /><Metric label="Outstanding" tone="red" value={money((fees || []).reduce((sum, fee) => sum + (Number(fee.amount) - Number(fee.paid_amount)), 0))} /></section>}{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <section className="panel table-panel"><DataTable headers={role === 'admin' ? ['Student', type === 'monthly' ? 'Month' : 'Fee / Exam', 'Amount', 'Paid', 'Status', ''] : [type === 'monthly' ? 'Month' : 'Fee / Exam', 'Amount', 'Paid', 'Status']} rows={(fees || []).map((fee) => { const core = [type === 'monthly' ? fee.fee_month : (fee.exam_title || fee.fee_name), money(fee.amount), money(fee.paid_amount), <Status key="status" value={fee.status} />]; return role === 'admin' ? [fee.student_name, ...core, <button key="delete" className="danger-link" onClick={() => remove(fee)}>Delete</button>] : core })} empty="No fee records found." /></section>}{showForm && <FeeModal type={type} students={students?.rows || []} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); setRefreshKey((key) => key + 1) }} />}</>
}

function FeeModal({ type, students, onClose, onDone }) {
  const [form, setForm] = useState({ student_id: '', fee_month: currentMonth(), fee_name: '', exam_id: '', amount: '', paid_amount: '0', paid_at: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const payload = { ...form, amount: Number(form.amount), paid_amount: Number(form.paid_amount || 0), paid_at: form.paid_at || null }; if (type === 'monthly') delete payload.fee_name; else { delete payload.fee_month; delete payload.exam_id } await api.post(type === 'monthly' ? '/fees/monthly' : '/fees/exam', payload); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } finally { setBusy(false) } }
  return <Modal title={`Add ${type === 'monthly' ? 'monthly' : 'exam'} fee`} onClose={onClose}><form onSubmit={submit} className="form-grid"><label className="full">Student<select required value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name} ({student.student_code})</option>)}</select></label>{type === 'monthly' ? <Field label="Fee month" type="month" value={form.fee_month} onChange={(value) => setForm({ ...form, fee_month: value })} required /> : <Field label="Fee name" value={form.fee_name} onChange={(value) => setForm({ ...form, fee_name: value })} required />}<Field label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required /><Field label="Paid amount" type="number" value={form.paid_amount} onChange={(value) => setForm({ ...form, paid_amount: value })} /><Field label="Paid date" type="date" value={form.paid_at} onChange={(value) => setForm({ ...form, paid_at: value })} />{error && <p className="form-error full">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Save fee'}</button></form></Modal>
}

function AttendancePage({ role }) {
  const [date, setDate] = useState(today()); const [refreshKey, setRefreshKey] = useState(0); const [record, setRecord] = useState({ student_id: '', status: 'present', note: '' }); const [error, setError] = useState('')
  const { data: rows, loading, error: loadError, reload } = useRequest(() => api.get('/attendance', { params: role === 'admin' ? { date } : {} }), [role, date, refreshKey])
  const { data: students } = useRequest(() => role === 'admin' ? api.get('/students', { params: { limit: 100 } }) : Promise.resolve({ data: { data: { rows: [] } } }), [role])
  const save = async (event) => { event.preventDefault(); setError(''); try { await api.post('/attendance', { ...record, attendance_date: date }); setRecord({ student_id: '', status: 'present', note: '' }); setRefreshKey((key) => key + 1) } catch (requestError) { setError(getErrorMessage(requestError)) } }
  return <><Header eyebrow="CLASS RECORDS" title="Attendance"><label className="date-picker">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></Header>{role === 'admin' && <section className="panel inline-form"><h3>Mark or update attendance</h3><form onSubmit={save}><select required value={record.student_id} onChange={(event) => setRecord({ ...record, student_id: event.target.value })}><option value="">Select student</option>{students?.rows?.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.student_code}</option>)}</select><select value={record.status} onChange={(event) => setRecord({ ...record, status: event.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select><input value={record.note} onChange={(event) => setRecord({ ...record, note: event.target.value })} placeholder="Optional note" /><button className="primary">Save</button></form>{error && <p className="form-error">{error}</p>}</section>}{loading ? <Loading /> : loadError ? <ErrorBox message={loadError} retry={reload} /> : <section className="panel table-panel"><DataTable headers={role === 'admin' ? ['Student', 'Date', 'Status', 'Note'] : ['Date', 'Status', 'Note']} rows={(rows || []).map((entry) => role === 'admin' ? [entry.student_name, dateText(entry.attendance_date), <Status key="status" value={entry.status} />, entry.note || '—'] : [dateText(entry.attendance_date), <Status key="status" value={entry.status} />, entry.note || '—'])} empty="No attendance records found." /></section>}</>
}

function ExamsPage({ role }) {
  const [refreshKey, setRefreshKey] = useState(0); const [showForm, setShowForm] = useState(false)
  const { data: exams, loading, error, reload } = useRequest(() => api.get('/exams'), [refreshKey])
  const remove = async (exam) => { if (!window.confirm(`Delete ${exam.title}?`)) return; try { await api.delete(`/exams/${exam.id}`); setRefreshKey((key) => key + 1) } catch (requestError) { window.alert(getErrorMessage(requestError)) } }
  return <><Header eyebrow="ASSESSMENTS" title="Exams">{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}>+ Create exam</button>}</Header>{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <section className="panel table-panel"><DataTable headers={role === 'admin' ? ['Exam', 'Date', 'Batch', 'Room', 'Status', ''] : ['Exam', 'Date', 'Batch', 'Room', 'Status']} rows={(exams || []).map((exam) => { const data = [exam.title, dateText(exam.exam_date), exam.batch || 'All batches', exam.room || 'TBA', <Status key="status" value={exam.status} />]; return role === 'admin' ? [...data, <button key="delete" className="danger-link" onClick={() => remove(exam)}>Delete</button>] : data })} empty="No exams scheduled." /></section>}{showForm && <ExamModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); setRefreshKey((key) => key + 1) }} />}</>
}

function ExamModal({ onClose, onDone }) { const [form, setForm] = useState({ title: '', exam_date: today(), batch: '', total_marks: '100', room: '', status: 'scheduled' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const submit = async (event) => { event.preventDefault(); setBusy(true); try { await api.post('/exams', { ...form, total_marks: Number(form.total_marks) }); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } finally { setBusy(false) } }; return <Modal title="Create exam" onClose={onClose}><form className="form-grid" onSubmit={submit}><Field label="Exam title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><Field label="Exam date" type="date" value={form.exam_date} onChange={(value) => setForm({ ...form, exam_date: value })} required /><Field label="Batch" value={form.batch} onChange={(value) => setForm({ ...form, batch: value })} /><Field label="Room" value={form.room} onChange={(value) => setForm({ ...form, room: value })} /><Field label="Total marks" type="number" value={form.total_marks} onChange={(value) => setForm({ ...form, total_marks: value })} required /><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="scheduled">Scheduled</option><option value="ongoing">Ongoing</option><option value="published">Published</option><option value="completed">Completed</option></select></label>{error && <p className="form-error full">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Create exam'}</button></form></Modal> }

function ResultsPage({ role }) {
  const [refreshKey, setRefreshKey] = useState(0); const [showForm, setShowForm] = useState(false)
  const { data: results, loading, error, reload } = useRequest(() => api.get('/results'), [refreshKey])
  const { data: students } = useRequest(() => role === 'admin' ? api.get('/students', { params: { limit: 100 } }) : Promise.resolve({ data: { data: { rows: [] } } }), [role])
  const { data: exams } = useRequest(() => role === 'admin' ? api.get('/exams') : Promise.resolve({ data: { data: [] } }), [role])
  const remove = async (result) => { if (!window.confirm('Delete this result?')) return; try { await api.delete(`/results/${result.id}`); setRefreshKey((key) => key + 1) } catch (requestError) { window.alert(getErrorMessage(requestError)) } }
  return <><Header eyebrow="ACADEMIC RESULTS" title="Results">{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}>+ Add result</button>}</Header>{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <section className="panel table-panel"><DataTable headers={role === 'admin' ? ['Student', 'Exam', 'Subject', 'Score', 'Grade', ''] : ['Exam', 'Subject', 'Score', 'Grade']} rows={(results || []).map((result) => { const row = [result.exam_title, result.subject, `${result.marks}/${result.total_marks}`, <Status key="status" value={result.grade} />]; return role === 'admin' ? [result.student_name, ...row, <button key="delete" className="danger-link" onClick={() => remove(result)}>Delete</button>] : row })} empty="No results have been published." /></section>}{showForm && <ResultModal students={students?.rows || []} exams={exams || []} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); setRefreshKey((key) => key + 1) }} />}</>
}

function ResultModal({ students, exams, onClose, onDone }) { const [form, setForm] = useState({ student_id: '', exam_id: '', subject: '', marks: '', total_marks: '100', remark: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const submit = async (event) => { event.preventDefault(); setBusy(true); try { await api.post('/results', { ...form, marks: Number(form.marks), total_marks: Number(form.total_marks) }); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } finally { setBusy(false) } }; return <Modal title="Add result" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>Student<select required value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label><label>Exam<select required value={form.exam_id} onChange={(event) => setForm({ ...form, exam_id: event.target.value })}><option value="">Select exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label><Field label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} required /><Field label="Marks" type="number" value={form.marks} onChange={(value) => setForm({ ...form, marks: value })} required /><Field label="Total marks" type="number" value={form.total_marks} onChange={(value) => setForm({ ...form, total_marks: value })} required /><Field label="Remark" value={form.remark} onChange={(value) => setForm({ ...form, remark: value })} />{error && <p className="form-error full">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Save result'}</button></form></Modal> }

function SeatPlansPage({ role }) {
  const [refreshKey, setRefreshKey] = useState(0); const [showForm, setShowForm] = useState(false)
  const { data: plans, loading, error, reload } = useRequest(() => api.get('/seat-plans'), [refreshKey])
  const { data: students } = useRequest(() => role === 'admin' ? api.get('/students', { params: { limit: 100 } }) : Promise.resolve({ data: { data: { rows: [] } } }), [role])
  const { data: exams } = useRequest(() => role === 'admin' ? api.get('/exams') : Promise.resolve({ data: { data: [] } }), [role])
  return <><Header eyebrow="EXAM ARRANGEMENT" title="Seat plans">{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}>+ Assign seat</button>}</Header>{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <section className="panel table-panel"><DataTable headers={role === 'admin' ? ['Student', 'Exam', 'Date', 'Room', 'Seat'] : ['Exam', 'Date', 'Room', 'Seat']} rows={(plans || []).map((plan) => role === 'admin' ? [plan.student_name, plan.exam_title, dateText(plan.exam_date), plan.room, plan.seat_number] : [plan.exam_title, dateText(plan.exam_date), plan.room, plan.seat_number])} empty="No seat plans are available." /></section>}{showForm && <SeatModal students={students?.rows || []} exams={exams || []} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); setRefreshKey((key) => key + 1) }} />}</>
}

function SeatModal({ students, exams, onClose, onDone }) { const [form, setForm] = useState({ student_id: '', exam_id: '', room: '', seat_number: '' }); const [error, setError] = useState(''); const submit = async (event) => { event.preventDefault(); try { await api.post('/seat-plans', form); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } }; return <Modal title="Assign seat" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>Student<select required value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label><label>Exam<select required value={form.exam_id} onChange={(event) => setForm({ ...form, exam_id: event.target.value })}><option value="">Select exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label><Field label="Room" value={form.room} onChange={(value) => setForm({ ...form, room: value })} required /><Field label="Seat number" value={form.seat_number} onChange={(value) => setForm({ ...form, seat_number: value })} required />{error && <p className="form-error full">{error}</p>}<button className="primary full">Save seat plan</button></form></Modal> }

function NoticesPage({ role }) {
  const [refreshKey, setRefreshKey] = useState(0); const [showForm, setShowForm] = useState(false)
  const { data: notices, loading, error, reload } = useRequest(() => api.get('/notices'), [refreshKey])
  const remove = async (notice) => { if (!window.confirm('Delete this notice?')) return; try { await api.delete(`/notices/${notice.id}`); setRefreshKey((key) => key + 1) } catch (requestError) { window.alert(getErrorMessage(requestError)) } }
  return <><Header eyebrow="COMMUNICATION" title="Notices">{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}>+ Publish notice</button>}</Header>{loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : <div className="notice-cards">{notices?.length ? notices.map((notice) => <article className="notice-card" key={notice.id}><span>✦</span><div><small>{dateText(notice.published_at)} · {notice.audience}</small><h3>{notice.title}</h3><p>{notice.body}</p></div>{role === 'admin' && <button className="danger-link" onClick={() => remove(notice)}>Delete</button>}</article>) : <Empty text="No notices available." />}</div>}{showForm && <NoticeModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); setRefreshKey((key) => key + 1) }} />}</>
}

function NoticeModal({ onClose, onDone }) { const [form, setForm] = useState({ title: '', body: '', audience: 'all', batch: '' }); const [error, setError] = useState(''); const submit = async (event) => { event.preventDefault(); try { await api.post('/notices', form); onDone() } catch (requestError) { setError(getErrorMessage(requestError)) } }; return <Modal title="Publish notice" onClose={onClose}><form className="form-grid" onSubmit={submit}><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><label>Audience<select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all">Everyone</option><option value="students">Students</option><option value="admins">Administrators</option><option value="batch">Specific batch</option></select></label>{form.audience === 'batch' && <Field label="Batch" value={form.batch} onChange={(value) => setForm({ ...form, batch: value })} required />}<label className="full">Notice content<textarea required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>{error && <p className="form-error full">{error}</p>}<button className="primary full">Publish notice</button></form></Modal> }

function Field({ label, type = 'text', value, onChange, required = false }) { return <label>{label}<input required={required} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} /></label> }
function Info({ label, value }) { return <div><dt>{label}</dt><dd>{value || '—'}</dd></div> }
function Modal({ title, children, onClose }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</section></div> }
function PanelTitle({ title }) { return <div className="panel-title"><h2>{title}</h2></div> }
function Person({ person }) { return <div className="person">{person.photo_path ? <img src={`${serverBaseUrl}${person.photo_path}`} alt="" /> : <span>{initial(person.full_name)}</span>}<div><b>{person.full_name}</b><small>{person.email}</small></div></div> }
function DataTable({ headers, rows, empty }) { return rows?.length ? <div className="table-scroll"><table><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : <Empty text={empty} /> }
function navIcon(id) { return ({ dashboard: '⌘', students: '◉', profile: '◉', 'monthly-fees': '৳', 'exam-fees': '◈', attendance: '◫', exams: '□', results: '★', 'seat-plans': '▦', notices: '✦' })[id] || '○' }

export default App
