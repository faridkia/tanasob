import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Bell, Bot, CalendarDays, Camera, Check, ChevronLeft, CircleUserRound,
  ClipboardList, CreditCard, Dumbbell, LayoutDashboard, LogOut, MessageCircle,
  Moon, Plus, QrCode, ScanLine, Send, Settings, ShieldCheck, Sparkles, Sun, Users, X,
} from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'

import api, { errorMessage, getItems } from './api'
import gymLoginImage from './assets/gym-login.png'

const roleLabel = { MEMBER: 'عضو', TRAINER: 'مربی', ADMIN: 'مدیر' }
const formatDate = (value) => value && new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value))
const formatPrice = (value) => `${new Intl.NumberFormat('fa-IR').format(value)} تومان`
// The AI occasionally answers with light Markdown despite being told not
// to (headings, bold, table pipes) — bubbles render as plain text, so strip
// the syntax rather than showing literal #/**/| characters.
const formatAiText = (text) => (text || '')
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/^[-*]\s+/gm, '• ')
  .replace(/^\|?[\s:-]*\|[\s:|-]*$/gm, '')
  .replace(/[ \t]*\|[ \t]*/g, '   ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('tanasob_theme') || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tanasob_theme', theme)
  }, [theme])

  useEffect(() => {
    if (!localStorage.getItem('tanasob_access')) return setReady(true)
    api.get('/auth/me/').then(({ data }) => setUser(data)).catch(logout).finally(() => setReady(true))
  }, [])

  const login = (payload) => {
    localStorage.setItem('tanasob_access', payload.tokens.access)
    localStorage.setItem('tanasob_refresh', payload.tokens.refresh)
    setUser(payload.user)
  }
  const logout = () => {
    localStorage.removeItem('tanasob_access')
    localStorage.removeItem('tanasob_refresh')
    setUser(null)
  }

  if (!ready) return <div className="boot"><Sparkles /> در حال آماده‌سازی تناسب...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage onLogin={login} />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <AuthPage register onLogin={login} />} />
      <Route path="*" element={user ? (
        <Shell user={user} setUser={setUser} logout={logout} theme={theme} setTheme={setTheme} />
      ) : <Navigate to="/login" />} />
    </Routes>
  )
}

function AuthPage({ register, onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', password2: '', full_name: '', phone: '', role: 'MEMBER' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const { data } = await api.post(register ? '/auth/register/' : '/auth/login/', form)
      onLogin(data); navigate('/')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <main className="auth-page">
      <section className="auth-intro" style={{ backgroundImage: `url(${gymLoginImage})` }}>
        <div className="brand-mark"><Activity /></div>
        <div className="auth-tagline"><h1>تناسب</h1><p>باشگاه هوشمند شما</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-line"><Activity /> <strong>تناسب</strong></div>
          <h2>{register ? 'ساخت حساب کاربری' : 'ورود به حساب'}</h2>
          <p>{register ? 'اطلاعات خود را وارد کنید.' : 'ایمیل و رمز عبور خود را وارد کنید.'}</p>
          <form onSubmit={submit} className="form-grid">
            {register && <><Field label="نام و نام خانوادگی" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} required />
              <Field label="شماره تماس" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /></>}
            <Field label="ایمیل" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
            <Field label="رمز عبور" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
            {register && <><Field label="تکرار رمز عبور" type="password" value={form.password2} onChange={(password2) => setForm({ ...form, password2 })} required />
              <label>نوع حساب<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="MEMBER">عضو باشگاه</option><option value="TRAINER">مربی</option></select></label></>}
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? 'لطفاً صبر کنید...' : register ? 'ساخت حساب' : 'ورود به تناسب'} <ChevronLeft size={18} /></button>
          </form>
          <button className="text-button" onClick={() => navigate(register ? '/login' : '/register')}>{register ? 'حساب داری؟ وارد شو' : 'حساب نداری؟ ثبت‌نام کن'}</button>
        </div>
      </section>
    </main>
  )
}

function Shell({ user, setUser, logout, theme, setTheme }) {
  const member = user.role === 'MEMBER', trainer = user.role === 'TRAINER', admin = user.role === 'ADMIN'
  const nav = [
    ['/', 'خانه', LayoutDashboard],
    ['/classes', 'کلاس‌ها', CalendarDays],
    ...(member ? [['/membership', 'اشتراک من', CreditCard], ['/card', 'کارت عضویت', QrCode], ['/progress', 'پیشرفت بدن', Activity]] : []),
    ...(!admin ? [['/plans', trainer ? 'برنامه‌سازی' : 'برنامه‌های من', ClipboardList], ['/messages', 'گفت‌وگوها', MessageCircle]] : []),
    ...(trainer ? [['/trainer', 'پنل مربی', Users]] : []),
    ...(admin ? [['/admin', 'مدیریت باشگاه', ShieldCheck]] : []),
    ['/notifications', 'اعلان‌ها', Bell],
    ['/profile', 'پروفایل', CircleUserRound],
  ]
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><span><Activity /></span><strong>تناسب</strong></div>
        <div className="user-mini"><div className="avatar">{user.full_name?.[0]}</div><div><strong>{user.full_name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={19} />{label}</NavLink>)}</nav>
        <button className="sidebar-bottom" onClick={logout}><LogOut size={18} /> خروج از حساب</button>
      </aside>
      <div className="mobile-nav">{nav.slice(0, 5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={18} /><span>{label}</span></NavLink>)}</div>
      <main className="workspace">
        <header className="topbar"><div><p className="eyebrow">TANASOB / {roleLabel[user.role]}</p><h1>سلام، {user.full_name?.split(' ')[0]} 👋</h1></div><div className="top-actions"><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><NavLink className="icon-button" to="/notifications"><Bell size={19} /></NavLink></div></header>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/membership" element={member ? <Memberships /> : <Navigate to="/" />} />
          <Route path="/card" element={member ? <MembershipCard user={user} /> : <Navigate to="/" />} />
          <Route path="/classes" element={<Classes user={user} />} />
          <Route path="/plans" element={!admin ? <Plans user={user} /> : <Navigate to="/" />} />
          <Route path="/progress" element={member ? <Progress /> : <Navigate to="/" />} />
          <Route path="/messages" element={!admin ? <Messages user={user} /> : <Navigate to="/" />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/trainer" element={trainer ? <TrainerPanel /> : <Navigate to="/" />} />
          <Route path="/admin" element={admin ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
        </Routes>
      </main>
      <AssistantWidget />
    </div>
  )
}

function useAssistantChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const ensureLoaded = () => {
    if (loaded) return
    setLoaded(true)
    api.get('/ai/chat/').then(({ data }) => setMessages(data)).catch((e) => setError(errorMessage(e)))
  }

  const send = async (text) => {
    const draft = { id: `draft-${Date.now()}`, role: 'USER', content: text }
    setMessages((prev) => [...prev, draft])
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/ai/chat/send/', { message: text })
      setMessages((prev) => [...prev, data])
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }

  return { messages, send, loading, error, ensureLoaded }
}

function AssistantPanel({ messages, send, loading, error }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, loading])
  const submit = (event) => {
    event.preventDefault()
    if (!text.trim() || loading) return
    send(text.trim())
    setText('')
  }
  return <div className="assistant-panel">
    <div className="chat-messages assistant-messages">
      {!messages.length && <p className="empty">سلام! هر سوالی درباره رزروها، اشتراک یا برنامه‌ات داری بپرس 👋</p>}
      {messages.map((item) => <div className={item.role === 'USER' ? 'bubble mine' : 'bubble'} key={item.id}>{item.role === 'USER' ? item.content : formatAiText(item.content)}</div>)}
      {loading && <div className="bubble assistant-typing"><span /><span /><span /></div>}
      <div ref={endRef} />
    </div>
    {error && <p className="form-error">{error}</p>}
    <form className="chat-form" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="پیامت را بنویس..." />
      <button className="button primary" disabled={loading}><Send size={18} /></button>
    </form>
  </div>
}

function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const chat = useAssistantChat()
  const toggle = () => {
    setOpen((value) => !value)
    if (!open) chat.ensureLoaded()
  }
  return <>
    {open && <div className="assistant-popover">
      <header><span className="assistant-title"><Bot size={17} /> یار هوشمند تناسب</span><button className="icon-button" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <AssistantPanel {...chat} />
    </div>}
    <button className="assistant-fab" onClick={toggle} aria-label="یار هوشمند">{open ? <X size={22} /> : <Bot size={22} />}</button>
  </>
}

function Dashboard({ user }) {
  const [data, setData] = useState({ sessions: [], plans: [], notices: [] })
  useEffect(() => {
    Promise.all([api.get('/sessions/'), api.get('/notifications/'), ...(user.role !== 'ADMIN' ? [api.get('/workout-plans/')] : [])]).then((responses) => setData({
      sessions: getItems(responses[0].data).slice(0, 4), notices: getItems(responses[1].data).slice(0, 3), plans: responses[2] ? getItems(responses[2].data) : [],
    })).catch(() => {})
  }, [user.role])
  const metrics = user.role === 'MEMBER' ? [['کلاس‌های پیش رو', data.sessions.length, CalendarDays], ['برنامه‌های فعال', data.plans.length, ClipboardList], ['انرژی این هفته', '۸۶٪', Sparkles]] : user.role === 'TRAINER' ? [['جلسات این هفته', data.sessions.length, CalendarDays], ['برنامه‌های فعال', data.plans.length, ClipboardList], ['تمرکز امروز', '۴ جلسه', Dumbbell]] : [['کلاس‌های فعال', data.sessions.length, CalendarDays], ['اعلان‌های تازه', data.notices.length, Bell], ['وضعیت سیستم', 'پایدار', ShieldCheck]]
  return <section className="page-stack"><section className="hero-card "><div><p className="eyebrow">نمای کلی</p><h2>{user.role === 'MEMBER' ? 'برنامه امروز شما' : 'وضعیت امروز باشگاه'}</h2><p>جلسات، اعلان‌ها و برنامه‌های فعال در یک نگاه.</p></div><div className="hero-graphic"><Dumbbell size={45} /></div></section><section className="metric-grid">{metrics.map(([label, value, Icon]) => <article className="metric-card " key={label}><span><Icon size={20} /></span><p>{label}</p><strong>{value}</strong></article>)}</section><section className="content-grid"><Card title="جلسات نزدیک" action="/classes">{data.sessions.length ? data.sessions.map((session) => <div className="list-row" key={session.id}><div className="date-chip"><b>{formatDate(session.session_date)}</b></div><div><strong>{session.gym_class_name}</strong><small>{session.trainer_name} · {session.start_time?.slice(0, 5)}</small></div><span className="capacity">{session.remaining_capacity} جای خالی</span></div>) : <Empty text="جلسه‌ای برای نمایش نیست." />}</Card><Card title="آخرین اعلان‌ها" action="/notifications">{data.notices.length ? data.notices.map((notice) => <div className="list-row" key={notice.id}><span className="notice-dot" /><div><strong>{notice.title}</strong><small>{notice.message}</small></div></div>) : <Empty text="اعلان تازه‌ای نداری." />}</Card></section></section>
}

function Memberships() {
  const [plans, setPlans] = useState([]); const [subscriptions, setSubscriptions] = useState([]); const [message, setMessage] = useState('')
  const load = () => Promise.all([api.get('/plans/'), api.get('/subscriptions/me/')]).then(([a, b]) => { setPlans(getItems(a.data)); setSubscriptions(getItems(b.data)) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const subscribe = async (plan) => { try { await api.post('/subscribe/', { plan: plan.id }); setMessage('اشتراک شما با موفقیت فعال شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const cancelSubscription = async (id) => { try { await api.post(`/subscriptions/${id}/cancel/`); setMessage('اشتراک لغو شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="اشتراک باشگاه" text="پلنی را انتخاب کن که با ریتم تمرینت هماهنگ است." /><Message text={message} /><div className="plan-grid">{plans.map((plan, index) => <article className={`plan-card  ${index === 1 ? 'featured' : ''}`} key={plan.id}>{index === 1 && <span className="pill">پیشنهاد تناسب</span>}<p>{plan.duration_days} روز دسترسی</p><h2>{plan.name}</h2><strong>{formatPrice(plan.price)}</strong><small>{plan.description}</small><button className="button primary" onClick={() => subscribe(plan)}>انتخاب پلن <ChevronLeft size={17} /></button></article>)}</div><Card title="اشتراک‌های من">{subscriptions.map((subscription) => <div className="list-row" key={subscription.id}><Status value={subscription.status} /><div><strong>{subscription.plan_name}</strong><small>تا {formatDate(subscription.end_date)}</small></div>{subscription.status === 'ACTIVE' && <button className="button muted" onClick={() => cancelSubscription(subscription.id)}>لغو اشتراک</button>}</div>) || <Empty text="هنوز اشتراکی ثبت نشده است." />}</Card></section>
}

function MembershipCard({ user }) {
  const [qrUrl, setQrUrl] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let objectUrl
    api.get('/auth/me/qr/', { responseType: 'blob' }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data)
      setQrUrl(objectUrl)
    }).catch((e) => setMessage(errorMessage(e)))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [])
  return <section className="page-stack"><PageTitle title="کارت عضویت" text="این کد را جلوی مربی بگیر تا حضورت با یک اسکن ثبت شود." /><Message text={message} /><section className="qr-card"><div className="qr-card-top"><span className="avatar">{user.full_name?.[0]}</span><div><strong>{user.full_name}</strong><small>عضو تناسب</small></div></div>{qrUrl ? <img className="qr-image" src={qrUrl} alt="کد QR عضویت" /> : <div className="qr-placeholder"><QrCode size={40} /></div>}<p className="qr-hint">مربی با اسکن این کد، بدون جست‌وجو، حضورت را در جلسه ثبت می‌کند.</p></section></section>
}

function QRCheckIn({ sessions, sessionId, setSessionId, onScan }) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)

  const stop = () => {
    setActive(false)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stop, [])

  const tick = () => {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        const token = code.data.replace('TANASOB-MEMBER:', '')
        stop()
        onScan(token, sessionId)
        return
      }
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  const start = async () => {
    if (!sessionId) { setError('اول یک جلسه انتخاب کن.'); return }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setActive(true)
      frameRef.current = requestAnimationFrame(tick)
    } catch {
      setError('دسترسی به دوربین ممکن نشد.')
    }
  }

  return <section className="content-card scanner-card"><header><h3><QrCode size={18} /> ثبت حضور با اسکن QR</h3></header><div className="scanner-controls"><select value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">انتخاب جلسه...</option>{sessions.map((session) => <option value={session.id} key={session.id}>{session.gym_class_name} · {formatDate(session.session_date)}</option>)}</select>{active ? <button className="button muted" onClick={stop}><X size={16} /> توقف اسکن</button> : <button className="button primary" onClick={start}><Camera size={16} /> شروع اسکن</button>}</div>{error && <p className="form-error">{error}</p>}<div className={`scanner-frame ${active ? 'active' : ''}`}><video ref={videoRef} playsInline muted className={active ? '' : 'hidden'} />{!active && <div className="scanner-placeholder"><ScanLine size={28} /><span>دوربین برای اسکن کارت عضویت اعضا</span></div>}</div><canvas ref={canvasRef} className="hidden" /></section>
}

function Classes({ user }) {
  const [sessions, setSessions] = useState([]); const [bookings, setBookings] = useState([]); const [message, setMessage] = useState('')
  const load = () => Promise.all([api.get('/sessions/'), ...(user.role === 'MEMBER' ? [api.get('/bookings/')] : [])]).then(([a, b]) => { setSessions(getItems(a.data)); setBookings(b ? getItems(b.data) : []) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [user.role])
  const book = async (id) => { try { await api.post('/bookings/', { session: id }); setMessage('رزرو با موفقیت ثبت شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const cancel = async (id) => { try { await api.post(`/bookings/${id}/cancel/`); setMessage('رزرو لغو شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="کلاس‌ها و جلسات" text={user.role === 'MEMBER' ? 'کلاس مناسب امروزت را انتخاب و رزرو کن.' : 'نمایی از برنامه‌ی کلاس‌های باشگاه.'} /><Message text={message} /><div className="session-grid">{sessions.map((session) => { const booking = bookings.find((item) => item.session === session.id && item.status === 'CONFIRMED'); return <article className="session-card " key={session.id}><div className="session-top"><span className="session-icon"><Dumbbell size={21} /></span><span>{formatDate(session.session_date)}</span></div><h3>{session.gym_class_name}</h3><p>{session.trainer_name}</p><div className="session-meta"><span>{session.start_time?.slice(0, 5)} تا {session.end_time?.slice(0, 5)}</span><span>{session.remaining_capacity} جای خالی</span></div>{user.role === 'MEMBER' && (booking ? <button className="button muted" onClick={() => cancel(booking.id)}>لغو رزرو</button> : <button className="button primary" disabled={session.is_full} onClick={() => book(session.id)}>{session.is_full ? 'تکمیل ظرفیت' : 'رزرو کلاس'}</button>)}</article> })}</div></section>
}

function Plans({ user }) {
  const [workouts, setWorkouts] = useState([]); const [diets, setDiets] = useState([]); const [assignments, setAssignments] = useState([]); const [message, setMessage] = useState('')
  const load = () => Promise.all([api.get('/workout-plans/'), api.get('/diet-plans/'), ...(user.role === 'TRAINER' ? [api.get('/auth/assignments/')] : [])]).then(([a, b, c]) => { setWorkouts(getItems(a.data)); setDiets(getItems(b.data)); setAssignments(c ? getItems(c.data) : []) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [user.role])
  const archive = async (type, id) => { try { await api.post(`/${type}/${id}/archive/`); setMessage('برنامه بایگانی شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title={user.role === 'TRAINER' ? 'برنامه‌سازی اعضا' : 'برنامه‌های من'} text={user.role === 'TRAINER' ? 'برنامه‌های تمرین و رژیم اعضای تحت مربی‌گری‌ات.' : 'جزئیات برنامه‌ی تمرینی و رژیم غذایی‌ات.'} /><Message text={message} />{user.role === 'TRAINER' && <PlanCreator assignments={assignments} onCreated={load} onError={setMessage} />}<div className="content-grid"><Card title="برنامه تمرینی">{workouts.map((plan) => <PlanCard key={plan.id} plan={plan} type="workout-plans" archive={user.role === 'TRAINER' ? archive : null} />) || <Empty text="برنامه تمرینی موجود نیست." />}</Card><Card title="رژیم غذایی">{diets.map((plan) => <PlanCard key={plan.id} plan={plan} type="diet-plans" archive={user.role === 'TRAINER' ? archive : null} diet />) || <Empty text="رژیم غذایی موجود نیست." />}</Card></div></section>
}

function Progress() {
  const [entries, setEntries] = useState([]); const [form, setForm] = useState({ recorded_at: new Date().toISOString().slice(0, 10), weight_kg: '', body_fat_percent: '', waist_cm: '', notes: '' }); const [message, setMessage] = useState('')
  const load = () => api.get('/progress/').then(({ data }) => setEntries(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const submit = async (event) => { event.preventDefault(); try { await api.post('/progress/', form); setMessage('اندازه‌گیری جدید ثبت شد.'); setForm({ ...form, weight_kg: '', body_fat_percent: '', waist_cm: '', notes: '' }); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="پیشرفت بدن" text="اعداد کوچک، تغییرهای بزرگ می‌سازند." /><Message text={message} /><div className="content-grid"><Card title="ثبت اندازه‌گیری"><form onSubmit={submit} className="form-grid compact"><Field label="تاریخ" type="date" value={form.recorded_at} onChange={(recorded_at) => setForm({ ...form, recorded_at })} required /><Field label="وزن (کیلوگرم)" type="number" value={form.weight_kg} onChange={(weight_kg) => setForm({ ...form, weight_kg })} required /><Field label="چربی بدن (%)" type="number" value={form.body_fat_percent} onChange={(body_fat_percent) => setForm({ ...form, body_fat_percent })} /><Field label="دور کمر (سانتی‌متر)" type="number" value={form.waist_cm} onChange={(waist_cm) => setForm({ ...form, waist_cm })} /><button className="button primary">ثبت پیشرفت <Plus size={17} /></button></form></Card><Card title="روند اخیر">{entries.map((entry, index) => <div className="progress-row" key={entry.id}><div><strong>{entry.weight_kg} کیلوگرم</strong><small>{formatDate(entry.recorded_at)}</small></div><div className="progress-bar"><i style={{ width: `${Math.max(20, 100 - index * 12)}%` }} /></div><span>{entry.body_fat_percent || '—'}٪</span></div>) || <Empty text="اولین اندازه‌گیری را ثبت کن." />}</Card></div></section>
}

function Messages({ user }) {
  const [assignments, setAssignments] = useState([]); const [partner, setPartner] = useState(''); const [messages, setMessages] = useState([]); const [content, setContent] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { api.get('/auth/assignments/').then(({ data }) => { const items = getItems(data); setAssignments(items); if (items[0]) setPartner(String(user.role === 'MEMBER' ? items[0].trainer_user_id : items[0].member_user_id)) }).catch((e) => setMessage(errorMessage(e))) }, [user.role])
  useEffect(() => { if (partner) api.get(`/messages/?with=${partner}`).then(({ data }) => setMessages(getItems(data))).catch((e) => setMessage(errorMessage(e))) }, [partner])
  const send = async (event) => { event.preventDefault(); if (!content) return; try { await api.post('/messages/send/', { receiver: partner, content }); setContent(''); const { data } = await api.get(`/messages/?with=${partner}`); setMessages(getItems(data)) } catch (e) { setMessage(errorMessage(e)) } }
  const label = (item) => user.role === 'MEMBER' ? item.trainer_name : item.member_name
  const partnerId = (item) => String(user.role === 'MEMBER' ? item.trainer_user_id : item.member_user_id)
  return <section className="page-stack"><PageTitle title="گفت‌وگو با مربی" text="سؤال‌ها، بازخوردها و همراهی روزانه." /><Message text={message} /><div className="chat-layout "><aside>{assignments.map((item) => <button className={partnerId(item) === partner ? 'chat-person active' : 'chat-person'} key={item.id} onClick={() => setPartner(partnerId(item))}><span className="avatar">{label(item)?.[0]}</span>{label(item)}</button>)}</aside><section className="chat-window">{partner ? <><div className="chat-messages">{messages.map((item) => <div className={item.sender === user.id ? 'bubble mine' : 'bubble'} key={item.id}>{item.content}<small>{new Date(item.sent_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</small></div>)}</div><form className="chat-form" onSubmit={send}><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="پیامت را بنویس..." /><button className="button primary"><MessageCircle size={18} /></button></form></> : <Empty text="مخاطبی برای گفت‌وگو پیدا نشد." />}</section></div></section>
}

function Notifications() {
  const [items, setItems] = useState([]); const [message, setMessage] = useState('')
  const load = () => api.get('/notifications/').then(({ data }) => setItems(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const read = async (id) => { await api.post(`/notifications/${id}/read/`); load() }
  return <section className="page-stack"><PageTitle title="اعلان‌ها" text="هر چیزی که لازم است بدانید، همین‌جاست." /><Message text={message} /><Card title="همه اعلان‌ها" actionButton={<button className="text-button" onClick={() => api.post('/notifications/read-all/').then(load)}>خواندن همه</button>}>{items.map((item) => <button className={`notification-item ${item.is_read ? '' : 'unread'}`} onClick={() => read(item.id)} key={item.id}><span className="notice-dot" /><div><strong>{item.title}</strong><small>{item.message}</small></div><time>{formatDate(item.created_at)}</time></button>) || <Empty text="اعلانی وجود ندارد." />}</Card></section>
}

function TrainerPanel() {
  const [assignments, setAssignments] = useState([]); const [sessions, setSessions] = useState([]); const [message, setMessage] = useState(''); const [scanSession, setScanSession] = useState('')
  useEffect(() => { Promise.all([api.get('/auth/assignments/'), api.get('/sessions/')]).then(([a, b]) => { setAssignments(getItems(a.data)); setSessions(getItems(b.data)) }).catch((e) => setMessage(errorMessage(e))) }, [])
  const checkIn = async (member, session) => { try { await api.post('/attendance/check-in/', { member, session }); setMessage('حضور عضو ثبت شد.') } catch (e) { setMessage(errorMessage(e)) } }
  const checkInByToken = async (token, session) => { try { const { data } = await api.post('/attendance/check-in/', { token, session }); setMessage(`حضور ${data.member_name} با اسکن QR ثبت شد.`) } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="پنل مربی" text="اعضا، جلسات و ثبت حضور را یک‌جا مدیریت کن." /><Message text={message} /><QRCheckIn sessions={sessions} sessionId={scanSession} setSessionId={setScanSession} onScan={checkInByToken} /><div className="content-grid"><Card title="اعضای من">{assignments.map((item) => <div className="list-row" key={item.id}><span className="avatar">{item.member_name?.[0]}</span><div><strong>{item.member_name}</strong><small>عضو فعال</small></div><select onChange={(e) => e.target.value && checkIn(item.member, e.target.value)} defaultValue=""><option value="">ثبت حضور در...</option>{sessions.map((session) => <option value={session.id} key={session.id}>{session.gym_class_name} · {formatDate(session.session_date)}</option>)}</select></div>) || <Empty text="عضوی به شما اختصاص داده نشده است." />}</Card><Card title="جلسات من">{sessions.map((session) => <div className="list-row" key={session.id}><span className="session-icon"><CalendarDays size={17} /></span><div><strong>{session.gym_class_name}</strong><small>{formatDate(session.session_date)} · {session.start_time?.slice(0, 5)}</small></div><span className="capacity">{session.booked_count} رزرو</span></div>)}</Card></div></section>
}

function AdminPanel() {
  const [reports, setReports] = useState({ subscriptions: {}, revenue: {}, attendance: [], popular: {} }); const [message, setMessage] = useState('')
  useEffect(() => { Promise.all([api.get('/reports/subscriptions/'), api.get('/reports/revenue/'), api.get('/reports/attendance/'), api.get('/reports/popular/')]).then(([a, b, c, d]) => setReports({ subscriptions: a.data, revenue: b.data, attendance: getItems(c.data), popular: d.data })).catch((e) => setMessage(errorMessage(e))) }, [])
  return <section className="page-stack"><PageTitle title="مدیریت باشگاه" text="تصویر روشن از عملکرد و درآمد باشگاه." /><Message text={message} /><section className="metric-grid"><Metric label="اشتراک فعال" value={reports.subscriptions.active || 0} icon={Users} /><Metric label="کل درآمد" value={formatPrice(reports.revenue.total_revenue || 0)} icon={CreditCard} /><Metric label="پرداخت موفق" value={reports.revenue.successful_payments || 0} icon={Check} /></section><div className="content-grid"><Card title="محبوب‌ترین کلاس‌ها">{(reports.popular.popular_classes || []).map((item) => <div className="list-row" key={item.name}><span className="session-icon"><Dumbbell size={17} /></span><div><strong>{item.name}</strong><small>{item.category}</small></div><span className="capacity">{item.total_bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card><Card title="حضور در جلسات">{reports.attendance.map((item) => <div className="list-row" key={item.session_id}><div><strong>{item.gym_class}</strong><small>{formatDate(item.session_date)}</small></div><span className="capacity">{item.attendance} حضور / {item.bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card></div></section>
}

function Profile({ user, setUser }) {
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', ...(user.member || user.trainer || {}) }); const [message, setMessage] = useState('')
  const submit = async (event) => { event.preventDefault(); try { const { data } = await api.patch('/auth/me/', form); setUser({ ...user, ...data }); setMessage('پروفایل با موفقیت به‌روزرسانی شد.') } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="پروفایل من" text="اطلاعات حسابت را به‌روز نگه دار." /><Message text={message} /><Card title="اطلاعات شخصی"><form onSubmit={submit} className="form-grid two"><Field label="نام و نام خانوادگی" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} /><Field label="شماره تماس" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />{user.role === 'MEMBER' ? <><Field label="تاریخ تولد" type="date" value={form.date_of_birth || ''} onChange={(date_of_birth) => setForm({ ...form, date_of_birth })} /><Field label="آدرس" value={form.address || ''} onChange={(address) => setForm({ ...form, address })} /></> : user.role === 'TRAINER' ? <><Field label="تخصص" value={form.specialization || ''} onChange={(specialization) => setForm({ ...form, specialization })} /><Field label="سال سابقه" type="number" value={form.experience_years || ''} onChange={(experience_years) => setForm({ ...form, experience_years })} /></> : null}<button className="button primary">ذخیره تغییرات <Check size={17} /></button></form></Card></section>
}

function PlanCreator({ assignments, onCreated, onError }) {
  const [kind, setKind] = useState('workout-plans'); const [member, setMember] = useState(''); const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event) => { event.preventDefault(); if (!member || !title) return; setBusy(true); try { const item = kind === 'workout-plans' ? { exercise_name: 'حرکت پیشنهادی', sets: 3, reps: 12, notes: '' } : { meal_name: 'وعده اصلی', calories: 500, description: '' }; await api.post(`/${kind}/`, { member, title, start_date: new Date().toISOString().slice(0, 10), end_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), items: [item] }); setTitle(''); onCreated() } catch (e) { onError(errorMessage(e)) } finally { setBusy(false) } }
  return <Card title="ساخت سریع برنامه"><form className="inline-form" onSubmit={submit}><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="workout-plans">برنامه تمرینی</option><option value="diet-plans">رژیم غذایی</option></select><select value={member} onChange={(e) => setMember(e.target.value)}><option value="">انتخاب عضو</option>{assignments.map((item) => <option key={item.id} value={item.member}>{item.member_name}</option>)}</select><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان برنامه" /><button className="button primary" disabled={busy}><Plus size={17} /> ساخت</button></form></Card>
}

function PlanCard({ plan, type, archive, diet }) {
  return <article className="plan-row"><div><span className="plan-type">{diet ? 'رژیم' : 'تمرین'}</span><strong>{plan.title}</strong><small>{plan.trainer_name} · تا {formatDate(plan.end_date)}</small><div className="chip-list">{plan.items?.map((item) => <span key={item.id}>{diet ? `${item.meal_name} · ${item.calories} کالری` : `${item.exercise_name} · ${item.sets}×${item.reps}`}</span>)}</div></div>{archive && !plan.is_archived && <button className="icon-button" onClick={() => archive(type, plan.id)} title="بایگانی"><Settings size={17} /></button>}</article>
}

function PageTitle({ title, text }) { return <div className="page-title"><div><h2>{title}</h2><p>{text}</p></div></div> }
function Card({ title, children, action, actionButton }) { const navigate = useNavigate(); return <section className="content-card "><header><h3>{title}</h3>{actionButton || (action && <button className="text-button" onClick={() => navigate(action)}>مشاهده همه</button>)}</header>{children}</section> }
function Metric({ label, value, icon: Icon }) { return <article className="metric-card "><span><Icon size={20} /></span><p>{label}</p><strong>{value}</strong></article> }
function Field({ label, type = 'text', value, onChange, required }) { return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label> }
function Status({ value }) { return <span className={`status ${value?.toLowerCase()}`}>{value === 'ACTIVE' ? 'فعال' : value === 'EXPIRED' ? 'منقضی' : value === 'CANCELLED' ? 'لغو شده' : value}</span> }
function Empty({ text }) { return <p className="empty">{text}</p> }
function Message({ text }) { return text ? <p className="form-message">{text}</p> : null }

export default App
