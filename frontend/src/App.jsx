import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Award, ArrowLeft, Bell, Bot, Building2, CalendarDays, CalendarRange, Camera, Check, CheckCircle2,
  ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, CreditCard, Dumbbell, Edit2, Flame, HeartPulse,
  ImagePlus, Link2, LayoutDashboard, LogOut, MapPin, MessageCircle, Moon, Play, Plus, QrCode, RotateCcw, Salad,
  ScanLine, Search, Send, Settings, ShieldCheck, SkipForward, Sparkles, Sun, Target, Timer, Trash2, Trophy,
  UserCheck, UserPlus, UserX, Users, Video, X,
} from 'lucide-react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { AnimatePresence, motion } from 'framer-motion'
import Model from 'react-body-highlighter'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import api, { errorMessage, getItems } from './api'
import gymLoginImage from './assets/gym-login.png'
import landingImage from './assets/landingimage.png'

const roleLabel = { MEMBER: 'عضو', TRAINER: 'مربی', ADMIN: 'مدیر' }
const formatDate = (value) => value && new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value))
const formatPrice = (value) => `${new Intl.NumberFormat('fa-IR').format(value)} تومان`
const toPersianDigits = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
const formatDuration = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return toPersianDigits(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
}

// Standard MET-based calorie estimate: kcal = MET * 3.5 * weightKg / 200 * minutes.
const MET_VALUES = { WORKOUT: 6, WALK: 3.5, RUN: 8 }
const estimateCalories = (activityType, weightKg, seconds) => {
  const met = MET_VALUES[activityType] || 5
  return Math.max(1, Math.round((met * 3.5 * weightKg / 200) * (seconds / 60)))
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** The member's most recently logged body weight (falls back to 70kg for
 * anyone who hasn't logged one yet) — used to estimate calories burned. */
function useMemberWeight() {
  const [weight, setWeight] = useState(70)
  useEffect(() => {
    api.get('/progress/').then(({ data }) => {
      const items = getItems(data)
      if (items[0]?.weight_kg) setWeight(Number(items[0].weight_kg))
    }).catch(() => {})
  }, [])
  return weight
}

// Jalali <-> Gregorian conversion (the standard jalaali algorithm) — needed
// only to build a real Jalali calendar grid (which day-of-month falls under
// which weekday cell). Every date *label* elsewhere in the app already goes
// through Intl.DateTimeFormat('fa-IR', ...), which renders the same
// calendar system natively; this is purely for grid math.
function jalaliToGregorian(jy, jm, jd) {
  jy += 1595
  let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd
    + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186)
  let gy = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)
  const monthLens = [0, 31, isLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm
  for (gm = 1; gm <= 12; gm++) {
    if (gd <= monthLens[gm]) break
    gd -= monthLens[gm]
  }
  return [gy, gm, gd]
}

function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = (gm > 2) ? (gy + 1) : gy
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + (33 * Math.floor(days / 12053))
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  let jm, jd
  if (days < 186) {
    jm = 1 + Math.floor(days / 31)
    jd = 1 + (days % 31)
  } else {
    jm = 7 + Math.floor((days - 186) / 30)
    jd = 1 + ((days - 186) % 30)
  }
  return [jy, jm, jd]
}

const isoDate = (gy, gm, gd) => `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
const WEEKDAY_LABELS_SAT_FIRST = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

function jalaliMonthLength(jy, jm) {
  const [gy1, gm1, gd1] = jalaliToGregorian(jy, jm, 1)
  const [njy, njm] = jm === 12 ? [jy + 1, 1] : [jy, jm + 1]
  const [gy2, gm2, gd2] = jalaliToGregorian(njy, njm, 1)
  return Math.round((new Date(gy2, gm2 - 1, gd2) - new Date(gy1, gm1 - 1, gd1)) / 86400000)
}
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
      <Route path="/register-gym" element={user ? <Navigate to="/" /> : <RegisterGymPage onLogin={login} />} />
      {!user && <Route path="/" element={<Landing />} />}
      <Route path="*" element={user ? (
        <Shell user={user} setUser={setUser} logout={logout} theme={theme} setTheme={setTheme} />
      ) : <Navigate to="/login" />} />
    </Routes>
  )
}

const LANDING_NAV = ['خانه', 'درباره ما', 'خدمات', 'برنامه‌ها', 'تماس با ما']

const LANDING_FEATURES = [
  { icon: Trophy, title: 'نتایج واقعی', text: 'برنامه‌های علمی و اصولی برای رسیدن به بهترین نتیجه' },
  { icon: UserCheck, title: 'مربیان حرفه‌ای', text: 'مربیان باتجربه و دارای معتبرترین مدارک بین‌المللی' },
  { icon: ClipboardList, title: 'برنامه شخصی‌سازی شده', text: 'برنامه تمرینی و غذایی متناسب با هدف و شرایط بدنی تو' },
  { icon: HeartPulse, title: 'تجهیزات به‌روز', text: 'مدرن‌ترین دستگاه‌ها و محیطی استاندارد و تمیز' },
]

function Landing() {
  return <div className="landing">
    <div className="landing-top">
      <div className="landing-hero-image" style={{ backgroundImage: `url(${landingImage})` }} />
      <header className="landing-nav">
        <Link to="/login" className="landing-auth-btn"><CircleUserRound size={18} /> ورود / ثبت‌نام</Link>
        <nav className="landing-nav-links">{LANDING_NAV.map((label, index) => <a key={label} href="#" className={index === 0 ? 'active' : ''} onClick={(e) => e.preventDefault()}>{label}</a>)}</nav>
        <div className="landing-logo"><strong>تناسب</strong><span><Activity size={18} /></span></div>
      </header>

      <section className="landing-hero">
        <motion.div className="landing-hero-text" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: 'easeOut' }}>
          <p className="landing-eyebrow">باشگاه ورزشی تناسب</p>
          <h1>بهترین نسخه<br /><span>خودت باش</span></h1>
          <p className="landing-hero-desc">محیطی حرفه‌ای، مربیان مجرب و برنامه‌های تمرینی متناسب با هدف تو. ما کنارتم تا قوی‌تر، سالم‌تر و پرانرژی‌تر زندگی کنی.</p>
          <div className="landing-cta-row">
            <motion.div whileTap={{ scale: .96 }} whileHover={{ scale: 1.03 }}><Link to="/register" className="landing-btn landing-btn-primary">شروع کن <ArrowLeft size={18} /></Link></motion.div>
            <motion.button className="landing-btn landing-btn-ghost" whileTap={{ scale: .96 }} whileHover={{ scale: 1.03 }}><Play size={15} /> تماشای معرفی باشگاه</motion.button>
          </div>
          <Link to="/register-gym" className="landing-gym-cta"><Building2 size={15} /> صاحب باشگاهی؟ باشگاه خودت را در تناسب ثبت کن</Link>
        </motion.div>
      </section>
    </div>

    <section className="landing-features">
      <p className="landing-eyebrow center">چرا تناسب؟</p>
      <h2>همه چیز برای رسیدن به هدف تو</h2>
      <div className="landing-features-grid">{LANDING_FEATURES.map(({ icon: Icon, title, text }, i) => <motion.div className="landing-feature" key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: .4, delay: i * .08 }}><span><Icon size={22} /></span><strong>{title}</strong><p>{text}</p></motion.div>)}</div>
    </section>
  </div>
}

function AuthPage({ register, onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', password2: '', full_name: '', phone: '', role: 'MEMBER', organization: '' })
  const [organizations, setOrganizations] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    if (!register) return
    api.get('/organizations/').then(({ data }) => setOrganizations(getItems(data))).catch(() => {})
  }, [register])
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
              <label>باشگاه<select value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} required>
                <option value="">انتخاب باشگاه</option>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select></label>
              <label>نوع حساب<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="MEMBER">عضو باشگاه</option><option value="TRAINER">مربی</option></select></label></>}
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? 'لطفاً صبر کنید...' : register ? 'ساخت حساب' : 'ورود به تناسب'} <ChevronLeft size={18} /></button>
          </form>
          <button className="text-button" onClick={() => navigate(register ? '/login' : '/register')}>{register ? 'حساب داری؟ وارد شو' : 'حساب نداری؟ ثبت‌نام کن'}</button>
          {register && <Link to="/register-gym" className="text-button"><Building2 size={15} /> می‌خوای باشگاه خودتو ثبت کنی؟</Link>}
        </div>
      </section>
    </main>
  )
}

function RegisterGymPage({ onLogin }) {
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', full_name: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const { data } = await api.post('/organizations/register/', form)
      onLogin(data); navigate('/')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <main className="auth-page">
      <section className="auth-intro" style={{ backgroundImage: `url(${gymLoginImage})` }}>
        <div className="auth-tagline"><h1>تناسب</h1><p>پلتفرم مدیریت باشگاه‌های ورزشی</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-line"><Building2 /> <strong>ثبت باشگاه جدید</strong></div>
          <h2>باشگاه خودت را راه‌اندازی کن</h2>
          <p>یک فضای کاملاً مستقل برای باشگاهت با اولین حساب مدیر بساز.</p>
          <form onSubmit={submit} className="form-grid">
            <Field label="نام باشگاه" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <Field label="آدرس" value={form.address} onChange={(address) => setForm({ ...form, address })} />
            <Field label="تلفن باشگاه" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            <Field label="نام و نام خانوادگی مدیر" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} required />
            <Field label="ایمیل مدیر" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
            <Field label="رمز عبور" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
            <Field label="تکرار رمز عبور" type="password" value={form.password2} onChange={(password2) => setForm({ ...form, password2 })} required />
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? 'لطفاً صبر کنید...' : 'ساخت باشگاه'} <ChevronLeft size={18} /></button>
          </form>
          <button className="text-button" onClick={() => navigate('/register')}>عضو یک باشگاه موجودی؟ ثبت‌نام معمولی</button>
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
    ['/events', 'رویدادها', CalendarRange],
    ['/competitions', 'مسابقات', Trophy],
    ['/leaderboard', 'جدول امتیازات', Award],
    ...(trainer || admin ? [['/exercises', 'کتابخانه حرکات', Dumbbell]] : []),
    ...(trainer ? [['/trainer', 'پنل مربی', Users]] : []),
    ...(admin ? [['/admin', 'مدیریت باشگاه', ShieldCheck]] : []),
    ['/notifications', 'اعلان‌ها', Bell],
    ['/profile', 'پروفایل', CircleUserRound],
  ]
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><span><Activity /></span><strong>{user.organization?.name || 'تناسب'}</strong></div>
        <nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20} />{label}</NavLink>)}</nav>
        <button className="sidebar-bottom" onClick={logout}><LogOut size={18} /> خروج از حساب</button>
      </aside>
      <div className="mobile-nav">{nav.slice(0, 5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={18} /><span>{label}</span></NavLink>)}</div>
      <main className="workspace">
        <header className="topbar"><div><h1>سلام، {user.full_name?.split(' ')[0]} 👋</h1></div><div className="top-actions"><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><NavLink className="icon-button" to="/notifications"><Bell size={19} /></NavLink></div></header>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/membership" element={member ? <Memberships /> : <Navigate to="/" />} />
            <Route path="/card" element={member ? <MembershipCard user={user} /> : <Navigate to="/" />} />
            <Route path="/classes" element={<Classes user={user} />} />
            <Route path="/plans" element={!admin ? <Plans user={user} /> : <Navigate to="/" />} />
            <Route path="/progress" element={member ? <Progress /> : <Navigate to="/" />} />
            <Route path="/messages" element={!admin ? <Messages user={user} /> : <Navigate to="/" />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/events" element={<EventsPage user={user} />} />
            <Route path="/competitions" element={<Competitions user={user} />} />
            <Route path="/exercises" element={(trainer || admin) ? <ExerciseLibrary /> : <Navigate to="/" />} />
            <Route path="/trainer" element={trainer ? <TrainerPanel /> : <Navigate to="/" />} />
            <Route path="/admin" element={admin ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          </Routes>
        </PageTransition>
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
    <AnimatePresence>
      {open && <motion.div className="assistant-popover" initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .96 }} transition={{ duration: .18, ease: 'easeOut' }}>
        <header><span className="assistant-title"><Bot size={17} /> یار هوشمند تناسب</span><button className="icon-button" onClick={() => setOpen(false)}><X size={16} /></button></header>
        <AssistantPanel {...chat} />
      </motion.div>}
    </AnimatePresence>
    <motion.button className="assistant-fab" onClick={toggle} aria-label="یار هوشمند" whileTap={{ scale: .9 }} whileHover={{ scale: 1.06 }}>{open ? <X size={22} /> : <Bot size={22} />}</motion.button>
  </>
}

function Dashboard({ user }) {
  const [data, setData] = useState({ sessions: [], plans: [], notices: [] })
  const [points, setPoints] = useState(null)
  const [goals, setGoals] = useState(null)
  const [calorieSummary, setCalorieSummary] = useState(null)
  const [events, setEvents] = useState([])
  useEffect(() => {
    Promise.all([api.get('/sessions/'), api.get('/notifications/'), ...(user.role !== 'ADMIN' ? [api.get('/workout-plans/')] : [])]).then((responses) => setData({
      sessions: getItems(responses[0].data).slice(0, 4), notices: getItems(responses[1].data).slice(0, 3), plans: responses[2] ? getItems(responses[2].data) : [],
    })).catch(() => {})
    if (user.role === 'MEMBER') {
      api.get('/progress/me/points/').then(({ data }) => setPoints(data)).catch(() => {})
      api.get('/progress/me/goals/').then(({ data }) => setGoals(data)).catch(() => {})
      api.get('/activities/summary/').then(({ data }) => setCalorieSummary(data)).catch(() => {})
    }
    api.get('/events/').then(({ data }) => setEvents(getItems(data).filter((e) => e.days_remaining >= 0).slice(0, 5))).catch(() => {})
  }, [user.role])
  const metrics = user.role === 'MEMBER' ? [['کلاس‌های پیش رو', data.sessions.length, CalendarDays, 'blue'], ['برنامه‌های فعال', data.plans.length, ClipboardList, 'purple']] : user.role === 'TRAINER' ? [['جلسات این هفته', data.sessions.length, CalendarDays, 'blue'], ['برنامه‌های فعال', data.plans.length, ClipboardList, 'purple'], ['تمرکز امروز', '۴ جلسه', Dumbbell, 'orange']] : [['کلاس‌های فعال', data.sessions.length, CalendarDays, 'blue'], ['اعلان‌های تازه', data.notices.length, Bell, 'pink'], ['وضعیت سیستم', 'پایدار', ShieldCheck, 'green']]
  return <section className="page-stack">
    {events.length ? <EventHeroSlider events={events} /> : (
      <motion.section className="hero-card " initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}><div><p className="eyebrow">نمای کلی</p><h2>{user.role === 'MEMBER' ? 'برنامه امروز شما' : 'وضعیت امروز باشگاه'}</h2><p>جلسات، اعلان‌ها و برنامه‌های فعال در یک نگاه.</p></div><div className="hero-graphic"><Dumbbell size={45} /></div></motion.section>
    )}
    <section className="metric-grid">{metrics.map(([label, value, Icon, color], i) => <motion.article className={`metric-card metric-card--${color}`} key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .06 }}><span className="icon-chip on-tile"><Icon size={20} /></span><p>{label}</p><strong>{value}</strong></motion.article>)}</section>
    {points && <PointsCard points={points} />}
    {goals && <GoalsCard goals={goals} />}
    {calorieSummary && <CaloriesBurnedCard summary={calorieSummary} />}
    <section className="content-grid"><Card title="جلسات نزدیک" action="/classes">{data.sessions.length ? data.sessions.map((session) => <div className="list-row" key={session.id}><div className="date-chip"><b>{formatDate(session.session_date)}</b></div><div><strong>{session.gym_class_name}</strong><small>{session.trainer_name} · {session.start_time?.slice(0, 5)}</small></div>{user.role !== 'MEMBER' && <span className="capacity">{session.remaining_capacity} جای خالی</span>}</div>) : <Empty text="جلسه‌ای برای نمایش نیست." />}</Card><Card title="آخرین اعلان‌ها" action="/notifications">{data.notices.length ? data.notices.map((notice) => <div className="list-row" key={notice.id}><span className="notice-dot" /><div><strong>{notice.title}</strong><small>{notice.message}</small></div></div>) : <Empty text="اعلان تازه‌ای نداری." />}</Card></section></section>
}

/** Weekly/monthly attendance goals (real Attendance counts vs a sensible
 * fixed target) plus today's calorie target pulled from the member's diet
 * plan — three radial gauges, one row. */
function GoalsCard({ goals }) {
  const ring = (value, target) => {
    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0
    const r = 30, c = 2 * Math.PI * r
    return { pct, r, c, offset: c - (pct / 100) * c }
  }
  const weekly = ring(goals.weekly.count, goals.weekly.target)
  const monthly = ring(goals.monthly.count, goals.monthly.target)

  return <Card title="اهداف من">
    <div className="goals-grid">
      <div className="goal-gauge">
        <svg viewBox="0 0 70 70">
          <circle className="goal-gauge-track" cx="35" cy="35" r={weekly.r} />
          <motion.circle className="goal-gauge-fill goal-gauge-fill--blue" cx="35" cy="35" r={weekly.r}
            strokeDasharray={weekly.c} initial={{ strokeDashoffset: weekly.c }} animate={{ strokeDashoffset: weekly.offset }} transition={{ duration: .8, ease: 'easeOut' }} />
        </svg>
        <div className="goal-gauge-label"><strong>{goals.weekly.count}</strong><small>از {goals.weekly.target}</small></div>
        <p><Target size={13} /> هدف هفتگی</p>
      </div>
      <div className="goal-gauge">
        <svg viewBox="0 0 70 70">
          <circle className="goal-gauge-track" cx="35" cy="35" r={monthly.r} />
          <motion.circle className="goal-gauge-fill goal-gauge-fill--purple" cx="35" cy="35" r={monthly.r}
            strokeDasharray={monthly.c} initial={{ strokeDashoffset: monthly.c }} animate={{ strokeDashoffset: monthly.offset }} transition={{ duration: .8, ease: 'easeOut', delay: .1 }} />
        </svg>
        <div className="goal-gauge-label"><strong>{goals.monthly.count}</strong><small>از {goals.monthly.target}</small></div>
        <p><Target size={13} /> هدف ماهانه</p>
      </div>
      <div className="goal-calorie">
        <span className="icon-chip on-tile"><Flame size={20} /></span>
        <div><strong>{new Intl.NumberFormat('fa-IR').format(goals.calorie_target)}</strong><small>کالری هدف روزانه</small></div>
      </div>
    </div>
  </Card>
}

/** Calories actually burned — real numbers from logged workout sessions
 * and GPS walks/runs (activities.ActivityLog), charted over the last week.
 * Always on the dashboard, per the brief. */
function CaloriesBurnedCard({ summary }) {
  const chartData = summary.chart.map((d) => ({
    label: new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(d.date)),
    calories: d.calories,
  }))
  return <Card title="کالری سوزانده شده" actionButton={<div className="calorie-totals"><span><Flame size={13} /> امروز: {toPersianDigits(summary.today_calories)}</span><span>این هفته: {toPersianDigits(summary.week_calories)}</span></div>}>
    <div className="progress-chart"><ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea580c" stopOpacity={.4} />
            <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => [`${v} کالری`, '']} />
        <Area type="monotone" dataKey="calories" stroke="#ea580c" strokeWidth={2} fill="url(#calorieFill)" dot={{ r: 3, fill: '#ea580c', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer></div>
  </Card>
}

function PointsCard({ points }) {
  const progressPct = points.next_tier ? Math.min(100, Math.round((points.points / (points.points + points.next_tier.points_needed)) * 100)) : 100
  return <motion.section className="points-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .1 }}>
    <div className="points-card-top">
      <span className="points-tier-emoji">{points.tier_emoji}</span>
      <div><strong>{points.points} امتیاز</strong><small>سطح {points.tier}</small></div>
      <Link to="/leaderboard" className="text-button">جدول امتیازات</Link>
    </div>
    <div className="points-bar"><motion.div className="points-bar-fill" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: .6, ease: 'easeOut' }} /></div>
    {points.next_tier && <small className="points-next">{points.next_tier.points_needed} امتیاز تا سطح {points.next_tier.tier} {points.next_tier.tier_emoji}</small>}
  </motion.section>
}

function Leaderboard() {
  const [rows, setRows] = useState([]); const [myId, setMyId] = useState(null); const [message, setMessage] = useState('')
  useEffect(() => { api.get('/progress/leaderboard/').then(({ data }) => { setRows(data.leaderboard); setMyId(data.my_member_id) }).catch((e) => setMessage(errorMessage(e))) }, [])
  return <section className="page-stack"><PageTitle title="جدول امتیازات" text="امتیاز از حضور در کلاس‌ها، ثبت پیشرفت بدن و داشتن اشتراک فعال به‌دست می‌آید." /><Message text={message} />
    <Card title="رتبه‌بندی اعضا">
      {rows.length ? rows.map((row, i) => <motion.div className={`leaderboard-row ${row.member_id === myId ? 'me' : ''}`} key={row.member_id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .25, delay: i * .03 }}>
        <span className={`rank-badge rank-${row.rank <= 3 ? row.rank : 'other'}`}>{row.rank}</span>
        <div><strong>{row.full_name}</strong><small>{row.attendance_count} حضور</small></div>
        <span className="points-tier-emoji small">{row.tier_emoji}</span>
        <strong className="capacity">{row.points} امتیاز</strong>
      </motion.div>) : <Empty text="هنوز داده‌ای برای رتبه‌بندی وجود ندارد." />}
    </Card>
  </section>
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

const FACE_MODELS_URL = '/face-models'
let faceModelsPromise = null
// face-api.js pulls in a ~1MB TensorFlow.js runtime — dynamically imported
// so it only loads for users who actually open a face scanner, not on
// every page load.
function loadFaceModels() {
  faceModelsPromise ??= import('face-api.js').then((faceapi) =>
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL),
    ]).then(() => faceapi)
  )
  return faceModelsPromise
}

function FaceScanner({ title, hint, onCapture, disabled }) {
  const [modelsReady, setModelsReady] = useState(false)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const faceapiRef = useRef(null)

  useEffect(() => { loadFaceModels().then((faceapi) => { faceapiRef.current = faceapi; setModelsReady(true) }).catch(() => setStatus('بارگذاری مدل تشخیص چهره ناموفق بود.')) }, [])

  const stop = () => {
    setActive(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }
  useEffect(() => stop, [])

  const start = async () => {
    setStatus('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setActive(true)
    } catch {
      setStatus('دسترسی به دوربین ممکن نشد.')
    }
  }

  const capture = async () => {
    if (!videoRef.current) return
    setBusy(true)
    setStatus('در حال تحلیل چهره...')
    try {
      const faceapi = faceapiRef.current
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!detection) {
        setStatus('چهره‌ای پیدا نشد. مستقیم به دوربین نگاه کن و دوباره امتحان کن.')
        return
      }
      await onCapture(Array.from(detection.descriptor))
      stop()
    } catch {
      setStatus('خطایی در پردازش چهره رخ داد.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="face-scanner">
    {title && <h4>{title}</h4>}
    {hint && <p className="face-scanner-hint">{hint}</p>}
    <div className={`scanner-frame ${active ? 'active' : ''}`}>
      <video ref={videoRef} playsInline muted className={active ? '' : 'hidden'} />
      {!active && <div className="scanner-placeholder"><ScanLine size={28} /><span>{modelsReady ? 'دوربین برای اسکن چهره' : 'در حال آماده‌سازی مدل هوش مصنوعی...'}</span></div>}
    </div>
    {status && <p className="form-message">{status}</p>}
    <div className="scanner-controls">
      {active
        ? <><button className="button primary" onClick={capture} disabled={busy || disabled}><Camera size={16} /> {busy ? 'در حال تحلیل...' : 'ثبت چهره'}</button><button className="button muted" onClick={stop}><X size={16} /> توقف</button></>
        : <button className="button primary" onClick={start} disabled={!modelsReady || disabled}><Camera size={16} /> شروع دوربین</button>}
    </div>
  </div>
}

function FaceCheckIn({ sessions, sessionId, setSessionId, onScan }) {
  const [error, setError] = useState('')
  const capture = async (descriptor) => {
    if (!sessionId) { setError('اول یک جلسه انتخاب کن.'); return }
    setError('')
    await onScan(descriptor, sessionId)
  }
  return <section className="content-card scanner-card">
    <header><h3><Sparkles size={18} /> ثبت حضور با تشخیص چهره</h3></header>
    <div className="scanner-controls">
      <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
        <option value="">انتخاب جلسه...</option>
        {sessions.map((session) => <option value={session.id} key={session.id}>{session.gym_class_name} · {formatDate(session.session_date)}</option>)}
      </select>
    </div>
    {error && <p className="form-error">{error}</p>}
    <FaceScanner hint="عضو باید قبلاً چهره‌اش را از صفحه پروفایل ثبت کرده باشد." onCapture={capture} />
  </section>
}

function Classes({ user }) {
  const admin = user.role === 'ADMIN'
  const [sessions, setSessions] = useState([]); const [bookings, setBookings] = useState([]); const [attendance, setAttendance] = useState([]); const [classes, setClasses] = useState([]); const [trainers, setTrainers] = useState([]); const [message, setMessage] = useState('')
  const load = () => {
    const calls = [api.get('/sessions/')]
    if (user.role === 'MEMBER') calls.push(api.get('/bookings/'), api.get('/attendance/'))
    if (admin) calls.push(api.get('/classes/'), api.get('/auth/trainers/'))
    return Promise.all(calls).then((results) => {
      setSessions(getItems(results[0].data))
      if (user.role === 'MEMBER') {
        setBookings(getItems(results[1].data))
        setAttendance(getItems(results[2].data))
      }
      if (admin) {
        setClasses(getItems(results[1].data))
        setTrainers(getItems(results[2].data))
      }
    }).catch((e) => setMessage(errorMessage(e)))
  }
  useEffect(() => { load() }, [user.role])
  const book = async (id) => { try { await api.post('/bookings/', { session: id }); setMessage('رزرو با موفقیت ثبت شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const cancel = async (id) => { try { await api.post(`/bookings/${id}/cancel/`); setMessage('رزرو لغو شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const selfCheckIn = async (sessionId) => { try { await api.post('/attendance/check-in/', { session: sessionId }); setMessage('حضورت ثبت شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="کلاس‌ها و جلسات" text={user.role === 'MEMBER' ? 'کلاس مناسب امروزت را انتخاب و رزرو کن.' : admin ? 'کلاس و جلسه جدید بساز و به مربی اختصاص بده.' : 'نمایی از برنامه‌ی کلاس‌های باشگاه.'} /><Message text={message} />{admin && <ClassSessionManager classes={classes} trainers={trainers} onChanged={load} setMessage={setMessage} />}<div className="session-grid">{sessions.map((session) => { const booking = bookings.find((item) => item.session === session.id && item.status === 'CONFIRMED'); const attended = attendance.some((item) => item.session === session.id); return <article className="session-card " key={session.id}><div className="session-top"><span className="session-icon"><Dumbbell size={21} /></span><span>{formatDate(session.session_date)}</span></div><h3>{session.gym_class_name}</h3><p>{session.trainer_name}</p><div className="session-meta"><span>{session.start_time?.slice(0, 5)} تا {session.end_time?.slice(0, 5)}</span><span>{session.remaining_capacity} جای خالی</span></div>{user.role === 'MEMBER' && (attended ? <span className="attended-badge"><Check size={15} /> حضورت ثبت شده</span> : booking ? <><button className="button primary" onClick={() => selfCheckIn(session.id)}>ثبت حضور</button><button className="button muted" onClick={() => cancel(booking.id)}>لغو رزرو</button></> : <button className="button primary" disabled={session.is_full} onClick={() => book(session.id)}>{session.is_full ? 'تکمیل ظرفیت' : 'رزرو کلاس'}</button>)}</article> })}</div></section>
}

const MUSCLE_GROUPS = [
  { value: 'CHEST', label: 'سینه' },
  { value: 'BACK', label: 'پشت' },
  { value: 'LEGS', label: 'پا' },
  { value: 'SHOULDERS', label: 'شانه' },
  { value: 'ARMS', label: 'بازو' },
  { value: 'CORE', label: 'شکم' },
  { value: 'CARDIO', label: 'هوازی' },
  { value: 'FULL_BODY', label: 'کل بدن' },
]
const muscleGroupLabel = (value) => MUSCLE_GROUPS.find((g) => g.value === value)?.label || value

const COMPETITION_LEVELS = [
  { value: 'ALL', label: 'همه سطوح' },
  { value: 'BEGINNER', label: 'مبتدی' },
  { value: 'INTERMEDIATE', label: 'متوسط' },
  { value: 'ADVANCED', label: 'پیشرفته' },
]
const competitionLevelLabel = (value) => COMPETITION_LEVELS.find((l) => l.value === value)?.label || value

function useCountdown(targetDate) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, new Date(`${targetDate}T00:00:00`).getTime() - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    done: diff <= 0,
  }
}

/** "Starts in" countdown blocks — the same treatment for both events and
 * competitions, since they're both "something happening on a future date." */
function Countdown({ targetDate, label = 'شروع تا' }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetDate)
  if (done) return <p className="countdown-live"><Sparkles size={14} /> رویداد شروع شده است</p>
  return <div className="countdown">
    {label && <p className="countdown-label">{label}</p>}
    <div className="countdown-blocks">
      {[[days, 'روز'], [hours, 'ساعت'], [minutes, 'دقیقه'], [seconds, 'ثانیه']].map(([value, unit]) => (
        <div className="countdown-block" key={unit}>
          <strong>{toPersianDigits(String(value).padStart(2, '0'))}</strong>
          <small>{unit}</small>
        </div>
      ))}
    </div>
  </div>
}

/** Which anatomical muscles each of our eight coarse groups covers. The
 * body model speaks in real anatomy (traps, delts, quads, ...) while the
 * rest of the app only tracks a single coarse group per exercise, so this
 * table is the bridge in both directions. */
const MUSCLE_GROUP_ANATOMY = {
  CHEST: ['chest'],
  BACK: ['trapezius', 'upper-back', 'lower-back'],
  SHOULDERS: ['front-deltoids', 'back-deltoids'],
  ARMS: ['biceps', 'triceps', 'forearm'],
  CORE: ['abs', 'obliques'],
  LEGS: ['quadriceps', 'hamstring', 'calves', 'gluteal', 'adductor', 'abductors', 'left-soleus', 'right-soleus'],
  // Not a muscle group as such — highlight the prime movers of running,
  // rowing and cycling so the diagram still says something true.
  CARDIO: ['quadriceps', 'hamstring', 'calves', 'gluteal', 'abs'],
}
MUSCLE_GROUP_ANATOMY.FULL_BODY = [...new Set(Object.values(MUSCLE_GROUP_ANATOMY).flat())]

// Reverse lookup for click-to-pick: anatomical muscle -> our coarse group.
const ANATOMY_TO_GROUP = Object.entries(MUSCLE_GROUP_ANATOMY)
  .filter(([group]) => group !== 'FULL_BODY' && group !== 'CARDIO')
  .reduce((acc, [group, muscles]) => {
    muscles.forEach((m) => { acc[m] ??= group })
    return acc
  }, { knees: 'LEGS' })

/** Signature element: an anatomical front + back body model that lights up
 * the muscles an exercise actually works. Read-only in plan details;
 * click-to-pick when building an exercise (`onSelect`). */
function MuscleDiagram({ selected, onSelect, size = 130 }) {
  const muscles = MUSCLE_GROUP_ANATOMY[selected] || []
  const data = muscles.length ? [{ name: muscleGroupLabel(selected), muscles }] : []
  const handleClick = onSelect
    ? ({ muscle }) => { const group = ANATOMY_TO_GROUP[muscle]; if (group) onSelect(group) }
    : undefined

  return (
    <div className={`muscle-diagram ${onSelect ? 'selectable' : ''}`}>
      {[['anterior', 'نمای جلو'], ['posterior', 'نمای پشت']].map(([type, label]) => (
        <figure className="muscle-diagram-view" key={type}>
          <Model
            type={type}
            data={data}
            onClick={handleClick}
            bodyColor="var(--muscle-body)"
            highlightedColors={['var(--accent)']}
            style={{ width: size, maxWidth: '100%' }}
          />
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/** Searchable exercise picker — a "combobox" over the exercise library
 * (name search + muscle-group chip), used anywhere a plain <select> would
 * be too flat for browsing a growing exercise list. */
function ExerciseCombobox({ exercises, value, onChange, placeholder = 'انتخاب حرکت' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)
  const selected = exercises.find((e) => String(e.id) === String(value))

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = exercises.filter((e) => e.name.includes(query))

  return (
    <div className="combobox" ref={boxRef}>
      <div className="combobox-input" onClick={() => setOpen((v) => !v)}>
        {selected ? <span>{selected.name}</span> : <span className="placeholder">{placeholder}</span>}
        {selected?.video_url && <Video size={14} />}
      </div>
      {open && (
        <div className="combobox-panel">
          <div className="combobox-search">
            <Search size={15} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی حرکت..." />
          </div>
          <div className="combobox-list">
            {filtered.length ? filtered.map((ex) => (
              <div className="combobox-option" key={ex.id} onClick={() => { onChange(ex.id); setOpen(false); setQuery('') }}>
                <span className="combobox-option-dot" />
                <span>{ex.name}</span>
                <small>{muscleGroupLabel(ex.muscle_group)}</small>
                {ex.video_url && <Video size={13} />}
              </div>
            )) : <div className="combobox-option"><small>حرکتی پیدا نشد.</small></div>}
          </div>
        </div>
      )}
    </div>
  )
}

const PLAN_KINDS = {
  'workout-plans': {
    label: 'تمرین',
    icon: Dumbbell,
    itemUnit: 'حرکت',
    daySplit: true,
    itemLine: (item) => <><strong>{item.exercise_name}</strong>{item.notes && <small>{item.notes}</small>}</>,
    itemStat: (item) => `${item.sets}×${item.reps}`,
  },
  'diet-plans': {
    label: 'رژیم',
    icon: Salad,
    itemUnit: 'وعده',
    itemLine: (item) => <><strong>{item.meal_name}</strong>{item.description && <small>{item.description}</small>}</>,
    itemStat: (item) => `${item.calories} کالری`,
  },
}

const planItemCount = (plan, config) => config.daySplit
  ? (plan.days || []).reduce((sum, day) => sum + (day.items?.length || 0), 0)
  : (plan.items?.length || 0)

function ExerciseLibrary() {
  const [exercises, setExercises] = useState([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [editingId, setEditingId] = useState(null) // null = not editing, 'new' = creating
  const [form, setForm] = useState({ name: '', muscle_group: 'FULL_BODY', video_url: '', description: '' })

  const load = () => api.get('/exercises/').then(({ data }) => setExercises(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])

  const startCreate = () => { setEditingId('new'); setForm({ name: '', muscle_group: 'FULL_BODY', video_url: '', description: '' }) }
  const startEdit = (ex) => { setEditingId(ex.id); setForm({ name: ex.name, muscle_group: ex.muscle_group, video_url: ex.video_url, description: ex.description }) }

  const submit = async (event) => {
    event.preventDefault()
    try {
      if (editingId === 'new') await api.post('/exercises/', form)
      else await api.patch(`/exercises/${editingId}/`, form)
      setMessage('حرکت ذخیره شد.')
      setEditingId(null)
      load()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  const remove = async (id) => {
    try { await api.delete(`/exercises/${id}/`); setMessage('حرکت حذف شد.'); load() } catch (e) { setMessage(errorMessage(e)) }
  }

  const filtered = exercises.filter((ex) => (!filterGroup || ex.muscle_group === filterGroup) && ex.name.includes(search))

  return <section className="page-stack">
    <PageTitle title="کتابخانه حرکات" text="حرکات تمرینی و ویدئوهای آموزشی باشگاه را مدیریت کن." />
    <Message text={message} />
    <div className="content-grid">
      <Card
        title={editingId === 'new' ? 'حرکت جدید' : editingId ? 'ویرایش حرکت' : 'حرکت جدید'}
        actionButton={!editingId && <button className="button primary" onClick={startCreate}><Plus size={16} /> افزودن حرکت</button>}
      >
        {editingId ? (
          <form onSubmit={submit} className="form-grid compact">
            <Field label="نام حرکت" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <label>گروه عضلانی
              <select value={form.muscle_group} onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}>
                {MUSCLE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>
            <MuscleDiagram selected={form.muscle_group} onSelect={(g) => setForm({ ...form, muscle_group: g })} />
            <Field label="لینک ویدئوی آموزشی (یوتیوب/آپارات)" value={form.video_url} onChange={(video_url) => setForm({ ...form, video_url })} />
            <label>توضیحات و نکات ایمنی
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </label>
            <div className="inline-form">
              <button className="button primary">ذخیره <Check size={16} /></button>
              <button type="button" className="button muted" onClick={() => setEditingId(null)}>انصراف</button>
            </div>
          </form>
        ) : <p className="empty">برای ساخت حرکت جدید روی «افزودن حرکت» بزن.</p>}
      </Card>
      <Card title="لیست حرکات">
        <div className="inline-form" style={{ marginBottom: '.6rem' }}>
          <input placeholder="جست‌وجو..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="">همه گروه‌ها</option>
            {MUSCLE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        {filtered.length ? filtered.map((ex) => (
          <div className="list-row" key={ex.id}>
            <span className="icon-chip blue"><Dumbbell size={16} /></span>
            <div><strong>{ex.name}</strong><small>{muscleGroupLabel(ex.muscle_group)}{ex.video_url && ' · دارای ویدئو'}</small></div>
            {ex.organization && <>
              <button className="icon-button" onClick={() => startEdit(ex)}><Edit2 size={15} /></button>
              <button className="icon-button" onClick={() => remove(ex.id)}><Trash2 size={15} /></button>
            </>}
          </div>
        )) : <Empty text="حرکتی پیدا نشد." />}
      </Card>
    </div>
  </section>
}

function Competitions({ user }) {
  const admin = user.role === 'ADMIN'
  const [competitions, setCompetitions] = useState([])
  const [message, setMessage] = useState('')
  const [openId, setOpenId] = useState(null)
  const load = () => api.get('/competitions/').then(({ data }) => setCompetitions(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const openComp = competitions.find((c) => c.id === openId) || null
  const featured = competitions.find((c) => c.is_active && c.days_remaining > 0) || competitions[0]

  return <section className="page-stack">
    <PageTitle title="مسابقات و چالش‌ها" text="در مسابقات باشگاه شرکت کن و به چالش کشیده شو." />
    <Message text={message} />
    {featured && (
      <motion.div className="competition-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
        <span className="competition-hero-badge"><Flame size={14} /> {featured.days_remaining} روز مانده</span>
        <h2>{featured.title}</h2>
        <p>{featured.description}</p>
        <button className="button primary" style={{ alignSelf: 'flex-start', background: '#fff', color: 'var(--accent-ink)', boxShadow: 'none' }} onClick={() => setOpenId(featured.id)}>مشاهده مسابقه <ChevronLeft size={16} /></button>
      </motion.div>
    )}
    {admin && <CompetitionManager onCreated={load} setMessage={setMessage} />}
    <Card title="مسابقات فعال">
      {competitions.length ? (
        <div className="competition-grid">
          {competitions.map((c, i) => (
            <motion.div className="competition-card" key={c.id} onClick={() => setOpenId(c.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .05 }}>
              <div className="competition-card-image">
                {c.image ? <img src={c.image} alt={c.title} /> : <Trophy size={28} />}
                <span className="competition-card-days">{c.days_remaining} روز مانده</span>
              </div>
              <div className="competition-card-body">
                <h4>{c.title}</h4>
                <div className="competition-card-meta">
                  <span className="competition-card-tag">{c.kind === 'INDIVIDUAL' ? 'فردی' : 'تیمی'}</span>
                  <span className="competition-card-tag">{competitionLevelLabel(c.level)}</span>
                </div>
                <div className="competition-card-footer">
                  <span>{c.participant_count} شرکت‌کننده</span>
                  {c.is_joined && <span className="status active">عضو شدی</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : <Empty text="مسابقه‌ای ثبت نشده است." />}
    </Card>
    <AnimatePresence>
      {openComp && <CompetitionDetailModal competition={openComp} onClose={() => setOpenId(null)} onChanged={load} setMessage={setMessage} canManage={admin} isMember={user.role === 'MEMBER'} />}
    </AnimatePresence>
  </section>
}

function CompetitionDetailModal({ competition, onClose, onChanged, setMessage, canManage, isMember }) {
  const [busy, setBusy] = useState(false)
  const join = async () => {
    setBusy(true)
    try {
      await api.post(`/competitions/${competition.id}/join/`)
      setMessage('با موفقیت در مسابقه ثبت‌نام شدی!')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    try { await api.delete(`/competitions/${competition.id}/`); setMessage('مسابقه حذف شد.'); onChanged(); onClose() } catch (e) { setMessage(errorMessage(e)) }
  }
  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <div className="competition-card-image" style={{ height: 140, borderRadius: 'var(--radius)' }}>
        {competition.image ? <img src={competition.image} alt="" /> : <Trophy size={32} />}
      </div>
      <h2>{competition.title}</h2>
      <p className="plan-modal-meta">{formatDate(competition.start_date)} تا {formatDate(competition.end_date)} · {competition.days_remaining} روز مانده</p>
      <div className="competition-card-meta">
        <span className="competition-card-tag">{competition.kind === 'INDIVIDUAL' ? 'فردی' : 'تیمی'}</span>
        <span className="competition-card-tag">{competitionLevelLabel(competition.level)}</span>
        <span className="competition-card-tag">{competition.participant_count} شرکت‌کننده</span>
      </div>
      <p>{competition.description}</p>
      {competition.start_date > todayIso() && <Countdown targetDate={competition.start_date} label="شروع مسابقه تا" />}
      {competition.prizes.length > 0 && <>
        <h4 style={{ margin: '.6rem 0 0' }}>جوایز</h4>
        {competition.prizes.map((p) => (
          <div className="prize-row" key={p.id}>
            <span className={`prize-rank rank-${p.rank <= 3 ? p.rank : 'other'}`}>{p.rank}</span>
            <span>{p.title}</span>
          </div>
        ))}
      </>}
      {isMember && (
        competition.is_joined
          ? <p className="form-message">تو در این مسابقه ثبت‌نام کردی. 🎉</p>
          : <button className="button primary" onClick={join} disabled={busy}><Award size={16} /> در این مسابقه شرکت کنم</button>
      )}
      {canManage && <button className="button muted" onClick={remove}><Trash2 size={16} /> حذف مسابقه</button>}
    </motion.div>
  </motion.div>
}

function CompetitionManager({ onCreated, setMessage }) {
  const blank = () => ({
    title: '', description: '', kind: 'INDIVIDUAL', level: 'ALL',
    start_date: todayIso(), end_date: todayIso(), prizes: [{ rank: 1, title: '' }],
  })
  const [form, setForm] = useState(blank())
  const [busy, setBusy] = useState(false)

  const updatePrize = (i, patch) => setForm((f) => ({ ...f, prizes: f.prizes.map((p, j) => j === i ? { ...p, ...patch } : p) }))
  const addPrize = () => setForm((f) => ({ ...f, prizes: [...f.prizes, { rank: f.prizes.length + 1, title: '' }] }))
  const removePrize = (i) => setForm((f) => ({ ...f, prizes: f.prizes.filter((_, j) => j !== i) }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/competitions/', form)
      setMessage('مسابقه جدید ساخته شد.')
      setForm(blank())
      onCreated()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }

  return <Card title="ساخت مسابقه جدید">
    <form onSubmit={submit} className="form-grid compact">
      <Field label="عنوان مسابقه" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <label>توضیحات<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label>نوع<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="INDIVIDUAL">فردی</option><option value="TEAM">تیمی</option></select></label>
      <label>سطح<select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{COMPETITION_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
      <Field label="تاریخ شروع" type="date" value={form.start_date} onChange={(start_date) => setForm({ ...form, start_date })} required />
      <Field label="تاریخ پایان" type="date" value={form.end_date} onChange={(end_date) => setForm({ ...form, end_date })} required />
      <div>
        <label>جوایز</label>
        {form.prizes.map((p, i) => (
          <div className="inline-form" key={i}>
            <input type="number" min="1" value={p.rank} onChange={(e) => updatePrize(i, { rank: Number(e.target.value) })} style={{ width: 60 }} />
            <input value={p.title} onChange={(e) => updatePrize(i, { title: e.target.value })} placeholder="عنوان جایزه" />
            {form.prizes.length > 1 && <button type="button" className="icon-button" onClick={() => removePrize(i)}><X size={14} /></button>}
          </div>
        ))}
        <button type="button" className="text-button" onClick={addPrize}><Plus size={14} /> افزودن جایزه</button>
      </div>
      <button className="button primary" disabled={busy}><Plus size={16} /> ساخت مسابقه</button>
    </form>
  </Card>
}

/** Dashboard hero slider — the first thing every role sees, showing what's
 * coming up at the gym. Auto-advances, but dots let you jump manually. */
function EventHeroSlider({ events }) {
  const [index, setIndex] = useState(0)
  const [detailEvent, setDetailEvent] = useState(null)
  useEffect(() => {
    if (events.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), 6000)
    return () => clearInterval(id)
  }, [events.length])
  if (!events.length) return null
  const event = events[index]

  return <>
    <AnimatePresence mode="wait">
      <motion.div
        key={event.id}
        className="event-hero"
        style={event.image ? { backgroundImage: `linear-gradient(90deg, rgba(10,13,18,.75), rgba(10,13,18,.15)), url(${event.image})` } : undefined}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .4 }}
      >
        <div className="event-hero-content">
          <span className="event-hero-badge"><CalendarRange size={13} /> {formatDate(event.event_date)}</span>
          <h2>{event.title}</h2>
          <p>{event.description}</p>
          <button className="button primary" onClick={() => setDetailEvent(event)}>جزئیات رویداد <ChevronLeft size={16} /></button>
        </div>
      </motion.div>
    </AnimatePresence>
    {events.length > 1 && <div className="event-hero-dots">
      {events.map((e, i) => <button key={e.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} aria-label={`رویداد ${i + 1}`} />)}
    </div>}
    <AnimatePresence>
      {detailEvent && <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />}
    </AnimatePresence>
  </>
}

function EventDetailModal({ event, onClose, canManage, onChanged, setMessage }) {
  const remove = async () => {
    try { await api.delete(`/events/${event.id}/`); setMessage?.('رویداد حذف شد.'); onChanged?.(); onClose() } catch (e) { setMessage?.(errorMessage(e)) }
  }
  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <div className="event-detail-layout">
        <div className="event-detail-banner" style={event.image ? { backgroundImage: `url(${event.image})` } : undefined}>
          {!event.image && <CalendarRange size={40} />}
        </div>
        <div className="event-detail-body">
          <h2>{event.title}</h2>
          <div className="event-detail-meta">
            <span><CalendarDays size={14} /> {formatDate(event.event_date)}</span>
            {event.location && <span><MapPin size={14} /> {event.location}</span>}
          </div>
          {event.days_remaining >= 0 && <Countdown targetDate={event.event_date} />}
          <p className="event-detail-desc">{event.description || 'توضیحاتی برای این رویداد ثبت نشده.'}</p>
          {canManage && <button className="button muted" onClick={remove}><Trash2 size={16} /> حذف رویداد</button>}
        </div>
      </div>
    </motion.div>
  </motion.div>
}

function EventManager({ onCreated, setMessage }) {
  const blank = () => ({ title: '', description: '', location: '', event_date: todayIso() })
  const [form, setForm] = useState(blank())
  const [imageFile, setImageFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data: created } = await api.post('/events/', form)
      if (imageFile) {
        const fd = new FormData()
        fd.append('image', imageFile)
        await api.patch(`/events/${created.id}/`, fd)
      }
      setMessage('رویداد جدید ساخته شد.')
      setForm(blank())
      setImageFile(null)
      onCreated()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }

  return <Card title="ساخت رویداد جدید">
    <form onSubmit={submit} className="form-grid compact">
      <Field label="عنوان رویداد" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <label>توضیحات<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <Field label="مکان (اختیاری)" value={form.location} onChange={(location) => setForm({ ...form, location })} />
      <Field label="تاریخ رویداد" type="date" value={form.event_date} onChange={(event_date) => setForm({ ...form, event_date })} required />
      <label>تصویر رویداد (اختیاری)
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </label>
      <button className="button primary" disabled={busy}><Plus size={16} /> ساخت رویداد</button>
    </form>
  </Card>
}

function EventsPage({ user }) {
  const admin = user.role === 'ADMIN'
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [openId, setOpenId] = useState(null)
  const load = () => api.get('/events/').then(({ data }) => setEvents(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const openEvent = events.find((e) => e.id === openId) || null

  return <section className="page-stack">
    <PageTitle title="رویدادهای باشگاه" text="از اتفاقات پیش روی باشگاه باخبر شو." />
    <Message text={message} />
    {admin && <EventManager onCreated={load} setMessage={setMessage} />}
    <Card title="رویدادهای پیش رو">
      {events.length ? (
        <div className="competition-grid">
          {events.map((e, i) => (
            <motion.div className="competition-card" key={e.id} onClick={() => setOpenId(e.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .05 }}>
              <div className="competition-card-image">
                {e.image ? <img src={e.image} alt={e.title} /> : <CalendarRange size={28} />}
                <span className="competition-card-days">{e.days_remaining >= 0 ? `${e.days_remaining} روز مانده` : 'برگزار شد'}</span>
              </div>
              <div className="competition-card-body">
                <h4>{e.title}</h4>
                <div className="competition-card-footer">
                  <span>{formatDate(e.event_date)}</span>
                  {e.location && <span><MapPin size={12} /> {e.location}</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : <Empty text="رویدادی ثبت نشده است." />}
    </Card>
    <AnimatePresence>
      {openEvent && <EventDetailModal event={openEvent} onClose={() => setOpenId(null)} canManage={admin} onChanged={load} setMessage={setMessage} />}
    </AnimatePresence>
  </section>
}

function Plans({ user }) {
  const [workouts, setWorkouts] = useState([]); const [diets, setDiets] = useState([]); const [assignments, setAssignments] = useState([]); const [message, setMessage] = useState('')
  const [walking, setWalking] = useState(false)
  const trainer = user.role === 'TRAINER'
  const member = user.role === 'MEMBER'
  const load = () => Promise.all([api.get('/workout-plans/'), api.get('/diet-plans/'), ...(trainer ? [api.get('/auth/assignments/')] : [])]).then(([a, b, c]) => { setWorkouts(getItems(a.data)); setDiets(getItems(b.data)); setAssignments(c ? getItems(c.data) : []) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [user.role])
  const archive = async (type, id) => { try { await api.post(`/${type}/${id}/archive/`); setMessage('برنامه بایگانی شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title={trainer ? 'برنامه‌سازی اعضا' : 'برنامه‌های من'} text={trainer ? 'برنامه‌های تمرین و رژیم اعضای تحت مربی‌گری‌ات.' : 'جزئیات برنامه‌ی تمرینی و رژیم غذایی‌ات.'} /><Message text={message} />
    {trainer && <WorkoutPlanBuilder assignments={assignments} onCreated={load} onError={setMessage} />}
    {trainer && <DietPlanQuickCreate assignments={assignments} onCreated={load} onError={setMessage} />}
    {member && <button className="button primary walk-launch-btn" onClick={() => setWalking(true)}><MapPin size={16} /> شروع پیاده‌روی</button>}
    <div className="content-grid"><PlanSection title="برنامه تمرینی" kind="workout-plans" plans={workouts} canEdit={trainer} archive={archive} onChanged={load} setMessage={setMessage} /><PlanSection title="رژیم غذایی" kind="diet-plans" plans={diets} canEdit={trainer} archive={archive} onChanged={load} setMessage={setMessage} /></div>
    <AnimatePresence>{walking && <WalkingTrackerModal onClose={() => setWalking(false)} />}</AnimatePresence>
  </section>
}

function PlanSection({ title, kind, plans, canEdit, archive, onChanged, setMessage }) {
  const [openId, setOpenId] = useState(null)
  const openPlan = plans.find((plan) => plan.id === openId) || null
  const config = PLAN_KINDS[kind]
  return <>
    <Card title={title}>{plans.length ? plans.map((plan) => <PlanRow key={plan.id} plan={plan} config={config} onOpen={() => setOpenId(plan.id)} />) : <Empty text={`${title} موجود نیست.`} />}</Card>
    <AnimatePresence>
      {openPlan && <PlanModal plan={openPlan} kind={kind} config={config} canEdit={canEdit} onClose={() => setOpenId(null)} archive={archive} onChanged={onChanged} setMessage={setMessage} />}
    </AnimatePresence>
  </>
}

function PlanRow({ plan, config, onOpen }) {
  const Icon = config.icon
  return <button className="plan-list-row" onClick={onOpen}>
    <span className="plan-row-thumb">{plan.image ? <img src={plan.image} alt="" /> : <Icon size={18} />}</span>
    <div><strong>{plan.title}</strong><small>{plan.trainer_name || plan.member_name} · تا {formatDate(plan.end_date)}</small></div>
    <span className="capacity">{planItemCount(plan, config)} {config.itemUnit}</span>
  </button>
}

function youtubeEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    let id = u.searchParams.get('v')
    if (!id && u.hostname.includes('youtu.be')) id = u.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${id}` : null
  } catch { return null }
}

function WorkoutCalendar({ days, selectedDate, onSelectDate }) {
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const today = new Date()
  const [todayJy, todayJm] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const [viewYear, setViewYear] = useState(todayJy)
  const [viewMonth, setViewMonth] = useState(todayJm)

  const monthLen = jalaliMonthLength(viewYear, viewMonth)
  const [firstGy, firstGm, firstGd] = jalaliToGregorian(viewYear, viewMonth, 1)
  const firstWeekday = new Date(firstGy, firstGm - 1, firstGd).getDay()
  const leadingBlanks = (firstWeekday + 1) % 7 // JS Sunday=0 -> Persian week starts Saturday

  const cells = Array(leadingBlanks).fill(null)
  for (let day = 1; day <= monthLen; day++) {
    const [gy, gm, gd] = jalaliToGregorian(viewYear, viewMonth, day)
    cells.push({ jDay: day, key: isoDate(gy, gm, gd) })
  }
  const monthLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long' }).format(new Date(firstGy, firstGm - 1, firstGd))
  const todayKey = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const prevMonth = () => viewMonth === 1 ? (setViewYear(viewYear - 1), setViewMonth(12)) : setViewMonth(viewMonth - 1)
  const nextMonth = () => viewMonth === 12 ? (setViewYear(viewYear + 1), setViewMonth(1)) : setViewMonth(viewMonth + 1)

  return <div className="workout-calendar">
    <div className="workout-calendar-head">
      <button className="icon-button" onClick={nextMonth}><ChevronRight size={16} /></button>
      <strong>{monthLabel}</strong>
      <button className="icon-button" onClick={prevMonth}><ChevronLeft size={16} /></button>
    </div>
    <div className="workout-calendar-grid">
      {WEEKDAY_LABELS_SAT_FIRST.map((w) => <span className="workout-calendar-weekday" key={w}>{w}</span>)}
      {cells.map((cell, i) => cell ? (
        <span
          key={cell.key}
          className={`workout-calendar-day ${dayMap.has(cell.key) ? 'has-workout' : ''} ${cell.key === selectedDate ? 'selected' : ''} ${cell.key === todayKey ? 'today' : ''}`}
          onClick={() => onSelectDate(cell.key)}
        >{toPersianDigits(cell.jDay)}</span>
      ) : <span className="workout-calendar-day empty" key={`empty-${i}`} />)}
    </div>
  </div>
}

function WorkoutPlanCalendarView({ days, planId }) {
  const [selectedDate, setSelectedDate] = useState(days[0]?.date || null)
  const [detailItem, setDetailItem] = useState(null)
  const [session, setSession] = useState(null)
  const selectedDay = days.find((d) => d.date === selectedDate)

  return <>
    <WorkoutCalendar days={days} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
    {selectedDay ? (
      <div className="plan-modal-days">
        <div className="plan-day-group">
          <div className="plan-day-group-head">
            <h4>{selectedDay.label || formatDate(selectedDay.date)}</h4>
            <button className="button primary session-start-btn" onClick={() => setSession(selectedDay)}><Play size={15} /> شروع تمرین</button>
          </div>
          <div className="workout-exercise-grid">
            {selectedDay.items.map((item) => (
              <button className="workout-exercise-card" key={item.id} onClick={() => setDetailItem(item)}>
                <div className="video-card">
                  {item.video_url ? <div className="video-card-play"><Play size={18} /></div> : <Dumbbell size={22} className="video-card-icon" />}
                </div>
                <strong>{item.exercise_name}</strong>
                <small>{muscleGroupLabel(item.muscle_group)} · {item.sets}×{item.reps}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : <Empty text="روزی با تمرین در این ماه ثبت نشده." />}
    <AnimatePresence>
      {detailItem && <ExerciseItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
      {session && <WorkoutSessionModal day={session} planId={planId} onClose={() => setSession(null)} />}
    </AnimatePresence>
  </>
}

/** Guided "start workout" flow — one exercise at a time, tap each set to
 * check it off (which kicks off a 60s rest timer, skippable), then move to
 * the next exercise. Purely a live in-session guide (no history is
 * persisted) — the point is walking the member through *today's* session,
 * not building a training log. */
function WorkoutSessionModal({ day, planId, onClose }) {
  const [index, setIndex] = useState(0)
  const [completedSets, setCompletedSets] = useState(() => day.items.map((it) => Array(it.sets).fill(false)))
  const [restSeconds, setRestSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [logged, setLogged] = useState(false)
  const weightKg = useMemberWeight()
  const item = day.items[index]
  const finished = index >= day.items.length
  const calories = estimateCalories('WORKOUT', weightKg, elapsed)

  useEffect(() => {
    if (restSeconds <= 0) return
    const id = setTimeout(() => setRestSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [restSeconds])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [finished])

  useEffect(() => {
    if (!finished || logged || elapsed === 0) return
    setLogged(true)
    api.post('/activities/', {
      activity_type: 'WORKOUT', workout_plan: planId,
      duration_seconds: elapsed, calories_burned: calories,
    }).catch(() => {})
  }, [finished])

  const toggleSet = (setIdx) => {
    const wasDone = completedSets[index][setIdx]
    setCompletedSets((prev) => prev.map((arr, i) => i === index ? arr.map((v, j) => j === setIdx ? !v : v) : arr))
    if (!wasDone) setRestSeconds(60)
  }
  const goNext = () => { setRestSeconds(0); setIndex((i) => i + 1) }
  const goPrev = () => { setRestSeconds(0); setIndex((i) => Math.max(0, i - 1)) }

  if (finished) {
    return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-card session-complete" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}>
        <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
        <CheckCircle2 size={52} className="session-complete-icon" />
        <h2>تمرین امروز تموم شد! 💪</h2>
        <p>{toPersianDigits(day.items.length)} حرکت با موفقیت انجام شد. آفرین!</p>
        <div className="session-summary">
          <div><Timer size={16} /><strong>{formatDuration(elapsed)}</strong><small>مدت زمان</small></div>
          <div><Flame size={16} /><strong>{toPersianDigits(calories)}</strong><small>کالری سوزانده شد</small></div>
        </div>
        <button className="button primary" onClick={onClose}>بستن</button>
      </motion.div>
    </motion.div>
  }

  const doneCount = completedSets[index].filter(Boolean).length

  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="modal-card session-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <div className="session-progress">
        <div className="session-progress-bar"><motion.div animate={{ width: `${(index / day.items.length) * 100}%` }} /></div>
        <div className="session-progress-foot">
          <small>حرکت {toPersianDigits(index + 1)} از {toPersianDigits(day.items.length)}</small>
          <small className="session-live-timer"><Timer size={12} /> {formatDuration(elapsed)}</small>
        </div>
      </div>
      <h2>{item.exercise_name}</h2>
      <p className="plan-modal-meta">{muscleGroupLabel(item.muscle_group)} · هدف: {item.sets}×{item.reps} · {toPersianDigits(doneCount)}/{toPersianDigits(item.sets)} ست انجام شد</p>
      {item.notes && <p className="session-notes">{item.notes}</p>}
      <div className="session-sets">
        {completedSets[index].map((done, i) => (
          <button key={i} className={`session-set ${done ? 'done' : ''}`} onClick={() => toggleSet(i)}>
            {done ? <CheckCircle2 size={18} /> : <span>{toPersianDigits(i + 1)}</span>}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {restSeconds > 0 && (
          <motion.div className="session-rest" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span><Timer size={15} /> استراحت: {toPersianDigits(restSeconds)} ثانیه</span>
            <button className="text-button" onClick={() => setRestSeconds(0)}><SkipForward size={13} /> رد کردن</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="session-nav">
        <button className="button muted" onClick={goPrev} disabled={index === 0}>حرکت قبلی</button>
        <button className="button primary" onClick={goNext}>{index === day.items.length - 1 ? 'پایان تمرین' : 'حرکت بعدی'} <ChevronLeft size={16} /></button>
      </div>
    </motion.div>
  </motion.div>
}

/** GPS-tracked walk/run — accumulates distance from consecutive
 * geolocation fixes (haversine, with a small jitter filter) while a live
 * timer and calorie estimate run alongside it. */
function WalkingTrackerModal({ onClose }) {
  const [active, setActive] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [distanceKm, setDistanceKm] = useState(0)
  const [error, setError] = useState('')
  const weightKg = useMemberWeight()
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const calories = estimateCalories('WALK', weightKg, elapsed)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [active])

  useEffect(() => () => { if (watchIdRef.current) navigator.geolocation?.clearWatch(watchIdRef.current) }, [])

  const start = () => {
    if (!navigator.geolocation) { setError('مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.'); return }
    setError('')
    navigator.geolocation.getCurrentPosition(
      () => {
        lastPosRef.current = null
        setDistanceKm(0); setElapsed(0); setActive(true)
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords
            if (lastPosRef.current) {
              const d = haversineKm(lastPosRef.current.lat, lastPosRef.current.lon, latitude, longitude)
              if (d > 0.002) { // ignore GPS jitter under ~2m so distance doesn't creep while standing still
                setDistanceKm((prev) => prev + d)
                lastPosRef.current = { lat: latitude, lon: longitude }
              }
            } else {
              lastPosRef.current = { lat: latitude, lon: longitude }
            }
          },
          () => setError('دریافت موقعیت مکانی با خطا مواجه شد.'),
          { enableHighAccuracy: true, maximumAge: 5000 },
        )
      },
      () => setError('دسترسی به موقعیت مکانی داده نشد. از تنظیمات مرورگر اجازه بده.'),
    )
  }

  const stop = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
    setActive(false)
    try {
      await api.post('/activities/', {
        activity_type: 'WALK', duration_seconds: elapsed,
        calories_burned: calories, distance_km: distanceKm.toFixed(2),
      })
    } catch { /* best-effort log; the session summary still shows locally */ }
    setFinished(true)
  }

  if (finished) {
    return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-card session-complete" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}>
        <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
        <CheckCircle2 size={52} className="session-complete-icon" />
        <h2>پیاده‌روی ثبت شد! 🚶</h2>
        <div className="session-summary">
          <div><Timer size={16} /><strong>{formatDuration(elapsed)}</strong><small>مدت زمان</small></div>
          <div><MapPin size={16} /><strong>{distanceKm.toFixed(2)}</strong><small>کیلومتر</small></div>
          <div><Flame size={16} /><strong>{toPersianDigits(calories)}</strong><small>کالری</small></div>
        </div>
        <button className="button primary" onClick={onClose}>بستن</button>
      </motion.div>
    </motion.div>
  }

  return <motion.div className="modal-overlay" onClick={!active ? onClose : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="modal-card session-complete" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }}>
      {!active && <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>}
      <span className="icon-chip on-tile walk-tracker-icon"><MapPin size={26} /></span>
      {active ? (
        <>
          <h2>در حال پیاده‌روی...</h2>
          <div className="session-summary">
            <div><Timer size={16} /><strong>{formatDuration(elapsed)}</strong><small>زمان</small></div>
            <div><MapPin size={16} /><strong>{distanceKm.toFixed(2)}</strong><small>کیلومتر</small></div>
            <div><Flame size={16} /><strong>{toPersianDigits(calories)}</strong><small>کالری</small></div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" onClick={stop}>پایان پیاده‌روی</button>
        </>
      ) : (
        <>
          <h2>شروع پیاده‌روی</h2>
          <p>مسیر و مسافت پیاده‌روی‌ات با موقعیت مکانی گوشی ثبت می‌شود.</p>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" onClick={start}><Play size={16} /> شروع کن</button>
        </>
      )}
    </motion.div>
  </motion.div>
}

function ExerciseItemDetailModal({ item, onClose }) {
  const embedUrl = youtubeEmbedUrl(item.video_url)
  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <h2>{item.exercise_name}</h2>
      <p className="plan-modal-meta">{item.sets}×{item.reps} تکرار{item.notes && ` · ${item.notes}`}</p>
      <MuscleDiagram selected={item.muscle_group} />
      <p className="muscle-diagram-caption">این حرکت روی «{muscleGroupLabel(item.muscle_group)}» فشار وارد می‌کند.</p>
      {item.video_url ? (
        embedUrl ? (
          <div className="video-embed-frame"><iframe src={embedUrl} title={item.exercise_name} allowFullScreen /></div>
        ) : (
          <a className="button primary" href={item.video_url} target="_blank" rel="noreferrer"><Video size={16} /> مشاهده ویدئوی آموزشی</a>
        )
      ) : <p className="empty">ویدئوی آموزشی برای این حرکت ثبت نشده.</p>}
    </motion.div>
  </motion.div>
}

function PlanModal({ plan, kind, config, canEdit, onClose, archive, onChanged, setMessage }) {
  const [uploading, setUploading] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const fileInputRef = useRef(null)
  const Icon = config.icon

  const uploadImage = async (file) => {
    if (!file) return
    const form = new FormData()
    form.append('image', file)
    setUploading(true)
    try {
      await api.post(`/${kind}/${plan.id}/image/`, form)
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) } finally { setUploading(false) }
  }

  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      {!config.daySplit && <>
        <div className={plan.image ? 'plan-modal-image zoomable' : 'plan-modal-image'} onClick={() => plan.image && setZoomed(true)}>
          {plan.image ? <img src={plan.image} alt={plan.title} /> : <div className="plan-modal-placeholder"><Icon size={30} /><span>عکسی ثبت نشده</span></div>}
          {uploading && <div className="plan-modal-uploading">در حال آپلود...</div>}
        </div>
        {zoomed && <div className="image-lightbox" onClick={() => setZoomed(false)}>
          <button className="icon-button modal-close" onClick={() => setZoomed(false)}><X size={17} /></button>
          <img src={plan.image} alt={plan.title} />
        </div>}
        {canEdit && <>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
          <button className="button muted plan-upload-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus size={16} /> {plan.image ? 'تغییر عکس' : 'آپلود عکس'}</button>
        </>}
      </>}
      <h2>{plan.title}</h2>
      <p className="plan-modal-meta">{plan.trainer_name || plan.member_name} · {formatDate(plan.start_date)} تا {formatDate(plan.end_date)}</p>
      {config.daySplit ? (
        <WorkoutPlanCalendarView days={plan.days || []} planId={plan.id} />
      ) : (
        <div className="plan-modal-items">{plan.items?.map((item) => <div className="plan-modal-item" key={item.id}><div>{config.itemLine(item)}</div><span className="capacity">{config.itemStat(item)}</span></div>)}</div>
      )}
      {canEdit && !plan.is_archived && <button className="button muted" onClick={() => { archive(kind, plan.id); onClose() }}><Settings size={16} /> بایگانی این {config.label}</button>}
    </motion.div>
  </motion.div>
}

const PROGRESS_FACTORS = [
  { key: 'weight_kg', label: 'وزن', unit: 'کیلوگرم' },
  { key: 'body_fat_percent', label: 'چربی بدن', unit: '٪' },
  { key: 'waist_cm', label: 'دور کمر', unit: 'سانتی‌متر' },
]

function Progress() {
  const [entries, setEntries] = useState([]); const [form, setForm] = useState({ recorded_at: new Date().toISOString().slice(0, 10), weight_kg: '', body_fat_percent: '', waist_cm: '', notes: '' }); const [message, setMessage] = useState('')
  const [factor, setFactor] = useState('weight_kg')
  const load = () => api.get('/progress/').then(({ data }) => setEntries(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const submit = async (event) => { event.preventDefault(); try { await api.post('/progress/', form); setMessage('اندازه‌گیری جدید ثبت شد.'); setForm({ ...form, weight_kg: '', body_fat_percent: '', waist_cm: '', notes: '' }); load() } catch (e) { setMessage(errorMessage(e)) } }

  const activeFactor = PROGRESS_FACTORS.find((item) => item.key === factor)
  const chartData = [...entries].reverse().map((entry) => ({
    date: formatDate(entry.recorded_at),
    value: entry[factor] === null || entry[factor] === undefined ? null : Number(entry[factor]),
  }))

  return <section className="page-stack"><PageTitle title="پیشرفت بدن" text="اعداد کوچک، تغییرهای بزرگ می‌سازند." /><Message text={message} /><div className="content-grid"><Card title="ثبت اندازه‌گیری"><form onSubmit={submit} className="form-grid compact"><Field label="تاریخ" type="date" value={form.recorded_at} onChange={(recorded_at) => setForm({ ...form, recorded_at })} required /><Field label="وزن (کیلوگرم)" type="number" value={form.weight_kg} onChange={(weight_kg) => setForm({ ...form, weight_kg })} required /><Field label="چربی بدن (%)" type="number" value={form.body_fat_percent} onChange={(body_fat_percent) => setForm({ ...form, body_fat_percent })} /><Field label="دور کمر (سانتی‌متر)" type="number" value={form.waist_cm} onChange={(waist_cm) => setForm({ ...form, waist_cm })} /><button className="button primary">ثبت پیشرفت <Plus size={17} /></button></form></Card><Card title="روند پیشرفت" actionButton={<div className="factor-toggle">{PROGRESS_FACTORS.map((item) => <button key={item.key} className={item.key === factor ? 'chip active' : 'chip'} onClick={() => setFactor(item.key)}>{item.label}</button>)}</div>}>{entries.length ? <><div className="progress-chart"><ResponsiveContainer width="100%" height={220}><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--ink)' }} formatter={(value) => [`${value} ${activeFactor.unit}`, activeFactor.label]} /><Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#progressFill)" connectNulls dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer></div><div className="progress-list">{entries.map((entry) => <div className="progress-row" key={entry.id}><div><strong>{formatDate(entry.recorded_at)}</strong><small>{entry.notes || 'یادداشتی ثبت نشده'}</small></div><div className="progress-values"><span>{entry.weight_kg} kg</span><span>{entry.body_fat_percent ?? '—'}%</span><span>{entry.waist_cm ?? '—'} cm</span></div></div>)}</div></> : <Empty text="اولین اندازه‌گیری را ثبت کن." />}</Card></div></section>
}

function Messages({ user }) {
  const [assignments, setAssignments] = useState([]); const [partner, setPartner] = useState(''); const [messages, setMessages] = useState([]); const [content, setContent] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { api.get('/auth/assignments/').then(({ data }) => { const items = getItems(data); setAssignments(items); if (items[0]) setPartner(String(user.role === 'MEMBER' ? items[0].trainer_user_id : items[0].member_user_id)) }).catch((e) => setMessage(errorMessage(e))) }, [user.role])
  useEffect(() => { if (partner) { api.get(`/messages/?with=${partner}`).then(({ data }) => setMessages(getItems(data))).catch((e) => setMessage(errorMessage(e))); api.post('/messages/mark-read/', { with: partner }).catch(() => {}) } }, [partner])
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
  const [assignments, setAssignments] = useState([]); const [sessions, setSessions] = useState([]); const [attendance, setAttendance] = useState([]); const [message, setMessage] = useState(''); const [scanSession, setScanSession] = useState(''); const [faceSession, setFaceSession] = useState(''); const [checkInMode, setCheckInMode] = useState('qr')
  const load = () => Promise.all([api.get('/auth/assignments/'), api.get('/sessions/'), api.get('/attendance/')]).then(([a, b, c]) => { setAssignments(getItems(a.data)); setSessions(getItems(b.data)); setAttendance(getItems(c.data)) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const announceCheckIn = (status, data) => setMessage(status === 201 ? `حضور ${data.member_name} ثبت شد.` : `${data.member_name} قبلاً برای این جلسه حضور زده بود.`)
  const checkIn = async (member, session) => { try { const { status, data } = await api.post('/attendance/check-in/', { member, session }); announceCheckIn(status, data); load() } catch (e) { setMessage(errorMessage(e)) } }
  const checkInByToken = async (token, session) => { try { const { status, data } = await api.post('/attendance/check-in/', { token, session }); announceCheckIn(status, data); load() } catch (e) { setMessage(errorMessage(e)) } }
  const checkInByFace = async (descriptor, session) => { try { const { status, data } = await api.post('/attendance/check-in/', { descriptor, session }); announceCheckIn(status, data); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="پنل مربی" text="اعضا، جلسات و ثبت حضور را یک‌جا مدیریت کن." /><Message text={message} />
    <div className="checkin-mode-toggle">
      <button className={checkInMode === 'qr' ? 'chip active' : 'chip'} onClick={() => setCheckInMode('qr')}><QrCode size={15} /> اسکن QR</button>
      <button className={checkInMode === 'face' ? 'chip active' : 'chip'} onClick={() => setCheckInMode('face')}><Sparkles size={15} /> تشخیص چهره</button>
    </div>
    {checkInMode === 'qr'
      ? <QRCheckIn sessions={sessions} sessionId={scanSession} setSessionId={setScanSession} onScan={checkInByToken} />
      : <FaceCheckIn sessions={sessions} sessionId={faceSession} setSessionId={setFaceSession} onScan={checkInByFace} />}
    <div className="content-grid"><Card title="اعضای من">{assignments.map((item) => { const attendedIds = new Set(attendance.filter((a) => a.member === item.member).map((a) => a.session)); const available = sessions.filter((session) => !attendedIds.has(session.id)); return <div className="member-checkin-row" key={item.id}><div className="member-checkin-top"><span className="avatar">{item.member_name?.[0]}</span><div><strong>{item.member_name}</strong><small>عضو فعال</small></div></div>{available.length ? <select onChange={(e) => e.target.value && checkIn(item.member, e.target.value)} defaultValue=""><option value="">ثبت حضور در...</option>{available.map((session) => <option value={session.id} key={session.id}>{session.gym_class_name} · {formatDate(session.session_date)}</option>)}</select> : <p className="member-checkin-done"><Check size={15} /> در همه جلسات حضور ثبت شده</p>}</div> }) || <Empty text="عضوی به شما اختصاص داده نشده است." />}</Card><Card title="جلسات من">{sessions.map((session) => <div className="list-row" key={session.id}><span className="session-icon"><CalendarDays size={17} /></span><div><strong>{session.gym_class_name}</strong><small>{formatDate(session.session_date)} · {session.start_time?.slice(0, 5)}</small></div><span className="capacity">{session.booked_count} رزرو</span></div>)}</Card></div></section>
}

function AdminPanel() {
  const [reports, setReports] = useState({ subscriptions: {}, revenue: {}, attendance: [], popular: {} }); const [trends, setTrends] = useState(null); const [message, setMessage] = useState('')
  const [users, setUsers] = useState([]); const [members, setMembers] = useState([]); const [trainers, setTrainers] = useState([])
  const loadUsers = () => Promise.all([api.get('/auth/users/'), api.get('/auth/members/'), api.get('/auth/trainers/')]).then(([a, b, c]) => { setUsers(getItems(a.data)); setMembers(getItems(b.data)); setTrainers(getItems(c.data)) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => {
    Promise.all([api.get('/reports/subscriptions/'), api.get('/reports/revenue/'), api.get('/reports/attendance/'), api.get('/reports/popular/')]).then(([a, b, c, d]) => setReports({ subscriptions: a.data, revenue: b.data, attendance: getItems(c.data), popular: d.data })).catch((e) => setMessage(errorMessage(e)))
    api.get('/reports/trends/').then(({ data }) => setTrends(data)).catch(() => {})
    loadUsers()
  }, [])
  return <section className="page-stack"><PageTitle title="مدیریت باشگاه" text="تصویر روشن از عملکرد و درآمد باشگاه." /><Message text={message} /><section className="metric-grid"><Metric label="اشتراک فعال" value={reports.subscriptions.active || 0} icon={Users} color="blue" /><Metric label="کل درآمد" value={formatPrice(reports.revenue.total_revenue || 0)} icon={CreditCard} color="green" /><Metric label="پرداخت موفق" value={reports.revenue.successful_payments || 0} icon={Check} color="purple" /></section>
    {trends && <AnalyticsCharts trends={trends} />}
    <div className="content-grid"><Card title="محبوب‌ترین کلاس‌ها">{(reports.popular.popular_classes || []).map((item) => <div className="list-row" key={item.name}><span className="session-icon"><Dumbbell size={17} /></span><div><strong>{item.name}</strong><small>{item.category}</small></div><span className="capacity">{item.total_bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card><Card title="حضور در جلسات">{reports.attendance.map((item) => <div className="list-row" key={item.session_id}><div><strong>{item.gym_class}</strong><small>{formatDate(item.session_date)}</small></div><span className="capacity">{item.attendance} حضور / {item.bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card></div><UserManager users={users} members={members} trainers={trainers} onChanged={loadUsers} setMessage={setMessage} /></section>
}

function AnalyticsCharts({ trends }) {
  return <div className="content-grid">
    <Card title="روند درآمد (۶ ماه اخیر)">
      {trends.revenue_trend.length ? <div className="progress-chart"><ResponsiveContainer width="100%" height={200}>
        <LineChart data={trends.revenue_trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => formatPrice(v)} />
          <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer></div> : <Empty text="داده‌ای موجود نیست." />}
    </Card>
    <Card title="رشد اعضا (۶ ماه اخیر)">
      {trends.member_growth.length ? <div className="progress-chart"><ResponsiveContainer width="100%" height={200}>
        <BarChart data={trends.member_growth} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
          <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer></div> : <Empty text="داده‌ای موجود نیست." />}
    </Card>
    <Card title="حضور بر اساس روز هفته">
      <div className="progress-chart"><ResponsiveContainer width="100%" height={200}>
        <BarChart data={trends.weekday_breakdown} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
          <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer></div>
    </Card>
  </div>
}

function UserManager({ users, members, trainers, onChanged, setMessage }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', password2: '', role: 'MEMBER' })
  const [busy, setBusy] = useState(false)
  const createUser = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/auth/users/', form)
      setForm({ full_name: '', email: '', phone: '', password: '', password2: '', role: 'MEMBER' })
      setMessage('حساب جدید ساخته شد.')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }
  const toggleActive = async (userItem) => {
    try {
      await api.patch(`/auth/users/${userItem.id}/`, { is_active: !userItem.is_active })
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  const [assignForm, setAssignForm] = useState({ member: '', trainer: '' })
  const [assignBusy, setAssignBusy] = useState(false)
  const createAssignment = async (event) => {
    event.preventDefault()
    if (!assignForm.member || !assignForm.trainer) return
    setAssignBusy(true)
    try {
      await api.post('/auth/assignments/', assignForm)
      setAssignForm({ member: '', trainer: '' })
      setMessage('مربی به عضو اختصاص یافت.')
    } catch (e) { setMessage(errorMessage(e)) } finally { setAssignBusy(false) }
  }

  return <div className="content-grid">
    <Card title="ساخت حساب مربی یا عضو">
      <form onSubmit={createUser} className="form-grid compact">
        <Field label="نام و نام خانوادگی" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} required />
        <Field label="ایمیل" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
        <Field label="شماره تماس" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        <label>نوع حساب<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="MEMBER">عضو باشگاه</option>
          <option value="TRAINER">مربی</option>
        </select></label>
        <Field label="رمز عبور" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
        <Field label="تکرار رمز عبور" type="password" value={form.password2} onChange={(password2) => setForm({ ...form, password2 })} required />
        <button className="button primary" disabled={busy}><UserPlus size={17} /> ساخت حساب</button>
      </form>
    </Card>
    <Card title="اختصاص مربی به عضو">
      <form onSubmit={createAssignment} className="form-grid compact">
        <label>عضو<select value={assignForm.member} onChange={(e) => setAssignForm({ ...assignForm, member: e.target.value })} required>
          <option value="">انتخاب عضو</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select></label>
        <label>مربی<select value={assignForm.trainer} onChange={(e) => setAssignForm({ ...assignForm, trainer: e.target.value })} required>
          <option value="">انتخاب مربی</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select></label>
        <button className="button primary" disabled={assignBusy}><Link2 size={16} /> اختصاص مربی</button>
      </form>
    </Card>
    <Card title="کاربران باشگاه">
      {users.length ? users.map((u) => <div className="list-row" key={u.id}>
        <span className="avatar">{u.full_name?.[0]}</span>
        <div><strong>{u.full_name}</strong><small>{u.email} · {roleLabel[u.role]}</small></div>
        <span className={u.is_active ? 'status active' : 'status expired'}>{u.is_active ? 'فعال' : 'غیرفعال'}</span>
        <button className="icon-button" onClick={() => toggleActive(u)} title={u.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}>{u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}</button>
      </div>) : <Empty text="کاربری ثبت نشده است." />}
    </Card>
  </div>
}

function ClassSessionManager({ classes, trainers, onChanged, setMessage }) {
  const [classForm, setClassForm] = useState({ name: '', category: '', description: '' })
  const [classBusy, setClassBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', description: '' })
  const createClass = async (event) => {
    event.preventDefault()
    if (!classForm.name) return
    setClassBusy(true)
    try {
      await api.post('/classes/', classForm)
      setClassForm({ name: '', category: '', description: '' })
      setMessage('کلاس جدید اضافه شد.')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) } finally { setClassBusy(false) }
  }

  const startEdit = (c) => { setEditingId(c.id); setEditForm({ name: c.name, category: c.category, description: c.description }) }
  const saveEdit = async (id) => {
    try {
      await api.patch(`/classes/${id}/`, editForm)
      setEditingId(null)
      setMessage('کلاس به‌روزرسانی شد.')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  const [sessionForm, setSessionForm] = useState({ gym_class: '', trainer: '', session_date: '', start_time: '', end_time: '', capacity: 15 })
  const [sessionBusy, setSessionBusy] = useState(false)
  const createSession = async (event) => {
    event.preventDefault()
    if (!sessionForm.gym_class || !sessionForm.trainer || !sessionForm.session_date || !sessionForm.start_time || !sessionForm.end_time) return
    setSessionBusy(true)
    try {
      await api.post('/sessions/', sessionForm)
      setSessionForm({ ...sessionForm, session_date: '', start_time: '', end_time: '' })
      setMessage('جلسه جدید ساخته شد و به مربی اختصاص یافت.')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) } finally { setSessionBusy(false) }
  }

  const deleteClass = async (id) => {
    try {
      await api.delete(`/classes/${id}/`)
      setMessage('کلاس حذف شد.')
      onChanged()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  return <div className="content-grid">
      <Card title="ساخت کلاس جدید">
        <form onSubmit={createClass} className="form-grid compact">
          <Field label="نام کلاس" value={classForm.name} onChange={(name) => setClassForm({ ...classForm, name })} required />
          <Field label="دسته‌بندی" value={classForm.category} onChange={(category) => setClassForm({ ...classForm, category })} />
          <Field label="توضیحات" value={classForm.description} onChange={(description) => setClassForm({ ...classForm, description })} />
          <button className="button primary" disabled={classBusy}>افزودن کلاس <Plus size={17} /></button>
        </form>
      </Card>
      <Card title="ساخت جلسه و اختصاص مربی">
        <form onSubmit={createSession} className="form-grid compact">
          <label>کلاس<select value={sessionForm.gym_class} onChange={(e) => setSessionForm({ ...sessionForm, gym_class: e.target.value })} required>
            <option value="">انتخاب کلاس</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>مربی<select value={sessionForm.trainer} onChange={(e) => setSessionForm({ ...sessionForm, trainer: e.target.value })} required>
            <option value="">انتخاب مربی</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select></label>
          <Field label="تاریخ" type="date" value={sessionForm.session_date} onChange={(session_date) => setSessionForm({ ...sessionForm, session_date })} required />
          <Field label="ساعت شروع" type="time" value={sessionForm.start_time} onChange={(start_time) => setSessionForm({ ...sessionForm, start_time })} required />
          <Field label="ساعت پایان" type="time" value={sessionForm.end_time} onChange={(end_time) => setSessionForm({ ...sessionForm, end_time })} required />
          <Field label="ظرفیت" type="number" value={sessionForm.capacity} onChange={(capacity) => setSessionForm({ ...sessionForm, capacity })} required />
          <button className="button primary" disabled={sessionBusy}>ساخت جلسه <Plus size={17} /></button>
        </form>
      </Card>
      <Card title="کلاس‌های موجود">
        {classes.length ? classes.map((c) => editingId === c.id ? (
          <div className="list-row class-edit-row" key={c.id}>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="نام کلاس" />
            <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="دسته‌بندی" />
            <button className="icon-button" onClick={() => saveEdit(c.id)} title="ذخیره"><Check size={16} /></button>
            <button className="icon-button" onClick={() => setEditingId(null)} title="انصراف"><X size={16} /></button>
          </div>
        ) : (
          <div className="list-row" key={c.id}><span className="session-icon"><Dumbbell size={17} /></span><div><strong>{c.name}</strong><small>{c.category || 'بدون دسته‌بندی'}</small></div><button className="icon-button" onClick={() => startEdit(c)} title="ویرایش کلاس"><Edit2 size={16} /></button><button className="icon-button" onClick={() => deleteClass(c.id)} title="حذف کلاس"><Trash2 size={16} /></button></div>
        )) : <Empty text="هنوز کلاسی ثبت نشده است." />}
      </Card>
    </div>
}

function Profile({ user, setUser }) {
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', ...(user.member || user.trainer || {}) }); const [message, setMessage] = useState('')
  const submit = async (event) => { event.preventDefault(); try { const { data } = await api.patch('/auth/me/', form); setUser({ ...user, ...data }); setMessage('پروفایل با موفقیت به‌روزرسانی شد.') } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="پروفایل من" text="اطلاعات حسابت را به‌روز نگه دار." /><Message text={message} /><Card title="اطلاعات شخصی"><form onSubmit={submit} className="form-grid two"><Field label="نام و نام خانوادگی" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} /><Field label="شماره تماس" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />{user.role === 'MEMBER' ? <><Field label="تاریخ تولد" type="date" value={form.date_of_birth || ''} onChange={(date_of_birth) => setForm({ ...form, date_of_birth })} /><Field label="آدرس" value={form.address || ''} onChange={(address) => setForm({ ...form, address })} /></> : user.role === 'TRAINER' ? <><Field label="تخصص" value={form.specialization || ''} onChange={(specialization) => setForm({ ...form, specialization })} /><Field label="سال سابقه" type="number" value={form.experience_years || ''} onChange={(experience_years) => setForm({ ...form, experience_years })} /></> : null}<button className="button primary">ذخیره تغییرات <Check size={17} /></button></form></Card>{user.role === 'MEMBER' && <FaceEnrollCard user={user} setUser={setUser} />}</section>
}

function FaceEnrollCard({ user, setUser }) {
  const [message, setMessage] = useState('')
  const hasFace = user.member?.has_face
  const enroll = async (descriptor) => {
    try {
      await api.post('/auth/me/face/', { descriptor })
      setUser({ ...user, member: { ...user.member, has_face: true } })
      setMessage('چهره‌ات با موفقیت ثبت شد. حالا مربی می‌تونه با اسکن چهره حضورت رو ثبت کنه.')
    } catch (e) { setMessage(errorMessage(e)) }
  }
  const remove = async () => {
    try {
      await api.delete('/auth/me/face/')
      setUser({ ...user, member: { ...user.member, has_face: false } })
      setMessage('چهره حذف شد.')
    } catch (e) { setMessage(errorMessage(e)) }
  }
  return <Card title="ثبت حضور با تشخیص چهره">
    <p className="face-scanner-hint">{hasFace ? 'چهره‌ات ثبت شده — مربی می‌تونه بدون کارت یا QR، فقط با اسکن چهره حضورت رو بزنه.' : 'چهره‌ات را یک‌بار ثبت کن تا مربی بتونه با اسکن چهره (بدون نیاز به کارت یا QR) حضورت را بزند.'}</p>
    <Message text={message} />
    {hasFace && <button className="button muted" onClick={remove}><Trash2 size={16} /> حذف چهره ثبت‌شده</button>}
    <FaceScanner onCapture={enroll} />
  </Card>
}

function DietPlanQuickCreate({ assignments, onCreated, onError }) {
  const [member, setMember] = useState(''); const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!member || !title) return
    setBusy(true)
    try {
      const start_date = new Date().toISOString().slice(0, 10)
      const end_date = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
      await api.post('/diet-plans/', { member, title, start_date, end_date, items: [{ meal_name: 'وعده اصلی', calories: 500, description: '' }] })
      setTitle(''); onCreated()
    } catch (e) { onError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Card title="ساخت سریع رژیم غذایی"><form className="inline-form" onSubmit={submit}>
    <select value={member} onChange={(e) => setMember(e.target.value)}><option value="">انتخاب عضو</option>{assignments.map((item) => <option key={item.id} value={item.member}>{item.member_name}</option>)}</select>
    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان رژیم" />
    <button className="button primary" disabled={busy}><Plus size={17} /> ساخت</button>
  </form></Card>
}

const emptyWorkoutItem = () => ({ key: Math.random(), exercise: '', sets: 3, reps: 12, notes: '' })
const todayIso = () => new Date().toISOString().slice(0, 10)
const emptyWorkoutDay = (date) => ({ key: Math.random(), date: date || todayIso(), label: '', items: [emptyWorkoutItem()] })

function WorkoutPlanBuilder({ assignments, onCreated, onError }) {
  const [member, setMember] = useState(''); const [title, setTitle] = useState('')
  const [days, setDays] = useState([emptyWorkoutDay()])
  const [exercises, setExercises] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/exercises/').then(({ data }) => setExercises(getItems(data))).catch(() => {}) }, [])

  const updateDay = (dayIndex, patch) => setDays((prev) => prev.map((d, i) => i === dayIndex ? { ...d, ...patch } : d))
  const addDay = () => setDays((prev) => [...prev, emptyWorkoutDay()])
  const removeDay = (dayIndex) => setDays((prev) => prev.filter((_, i) => i !== dayIndex))

  const updateItem = (dayIndex, itemIndex, patch) => setDays((prev) => prev.map((d, i) => i !== dayIndex ? d : {
    ...d, items: d.items.map((it, j) => j === itemIndex ? { ...it, ...patch } : it),
  }))
  const addItem = (dayIndex) => setDays((prev) => prev.map((d, i) => i !== dayIndex ? d : { ...d, items: [...d.items, emptyWorkoutItem()] }))
  const removeItem = (dayIndex, itemIndex) => setDays((prev) => prev.map((d, i) => i !== dayIndex ? d : { ...d, items: d.items.filter((_, j) => j !== itemIndex) }))

  const reset = () => { setMember(''); setTitle(''); setDays([emptyWorkoutDay()]) }

  const submit = async (event) => {
    event.preventDefault()
    if (!member || !title) { onError('عضو و عنوان برنامه را مشخص کن.'); return }
    if (days.some((d) => d.items.some((it) => !it.exercise))) { onError('برای هر ردیف یک حرکت از کتابخانه انتخاب کن.'); return }
    const dates = days.map((d) => d.date).sort()
    setBusy(true)
    try {
      await api.post('/workout-plans/', {
        member, title, start_date: dates[0], end_date: dates[dates.length - 1],
        days: days.map((d) => ({
          date: d.date, label: d.label,
          items: d.items.map((it) => ({ exercise: it.exercise, sets: Number(it.sets), reps: Number(it.reps), notes: it.notes })),
        })),
      })
      reset(); onCreated()
    } catch (e) { onError(errorMessage(e)) } finally { setBusy(false) }
  }

  return <Card title="ساخت برنامه تمرینی روزبه‌روز">
    <form onSubmit={submit} className="workout-builder">
      <div className="inline-form">
        <select value={member} onChange={(e) => setMember(e.target.value)}><option value="">انتخاب عضو</option>{assignments.map((item) => <option key={item.id} value={item.member}>{item.member_name}</option>)}</select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان برنامه" />
      </div>
      {days.map((day, dayIndex) => (
        <div className="workout-builder-day" key={day.key}>
          <div className="workout-builder-day-head">
            <input type="date" value={day.date} onChange={(e) => updateDay(dayIndex, { date: e.target.value })} required />
            <input value={day.label} onChange={(e) => updateDay(dayIndex, { label: e.target.value })} placeholder="عنوان روز (مثلاً روز پا)" />
            {days.length > 1 && <button type="button" className="icon-button" onClick={() => removeDay(dayIndex)}><Trash2 size={15} /></button>}
          </div>
          {day.items.map((item, itemIndex) => (
            <div className="workout-builder-item" key={item.key}>
              <ExerciseCombobox exercises={exercises} value={item.exercise} onChange={(exercise) => updateItem(dayIndex, itemIndex, { exercise })} />
              <input type="number" min="1" value={item.sets} onChange={(e) => updateItem(dayIndex, itemIndex, { sets: e.target.value })} placeholder="ست" />
              <input type="number" min="1" value={item.reps} onChange={(e) => updateItem(dayIndex, itemIndex, { reps: e.target.value })} placeholder="تکرار" />
              {day.items.length > 1 && <button type="button" className="icon-button" onClick={() => removeItem(dayIndex, itemIndex)}><X size={14} /></button>}
            </div>
          ))}
          <button type="button" className="text-button" onClick={() => addItem(dayIndex)}><Plus size={14} /> افزودن حرکت</button>
        </div>
      ))}
      <div className="inline-form">
        <button type="button" className="button muted" onClick={addDay}><Plus size={16} /> افزودن روز</button>
        <button className="button primary" disabled={busy}><Check size={16} /> ساخت برنامه</button>
      </div>
    </form>
  </Card>
}


function PageTitle({ title, text }) { return <div className="page-title"><div><h2>{title}</h2><p>{text}</p></div></div> }
function Card({ title, children, action, actionButton }) { const navigate = useNavigate(); return <section className="content-card "><header><h3>{title}</h3>{actionButton || (action && <button className="text-button" onClick={() => navigate(action)}>مشاهده همه</button>)}</header>{children}</section> }
function Metric({ label, value, icon: Icon, color = 'blue' }) { return <article className={`metric-card metric-card--${color}`}><span className="icon-chip on-tile"><Icon size={20} /></span><p>{label}</p><strong>{value}</strong></article> }
function Field({ label, type = 'text', value, onChange, required }) { return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label> }
function Status({ value }) { return <span className={`status ${value?.toLowerCase()}`}>{value === 'ACTIVE' ? 'فعال' : value === 'EXPIRED' ? 'منقضی' : value === 'CANCELLED' ? 'لغو شده' : value}</span> }
function Empty({ text }) { return <p className="empty">{text}</p> }
function Message({ text }) {
  return <AnimatePresence>
    {text && <motion.p className="form-message" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .22 }}>{text}</motion.p>}
  </AnimatePresence>
}

function PageTransition({ children }) {
  const location = useLocation()
  // React Router swaps <Routes> content the instant the location changes, so
  // there's no "outgoing" DOM left for an exit animation to play against —
  // keying on pathname still gives every page a clean fade/slide-in on entry.
  return <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, ease: 'easeOut' }}>
    {children}
  </motion.div>
}

export default App
