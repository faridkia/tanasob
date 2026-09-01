import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  Activity, Award, ArrowLeft, Bell, Bot, Building2, CalendarDays, CalendarRange, Camera, Check, CheckCircle2,
  ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, CreditCard, Dumbbell, Edit2, Flame, HeartPulse,
  Globe, ImagePlus, Link2, LayoutDashboard, LogOut, MapPin, MessageCircle, Moon, Newspaper, Play, Plus, QrCode, RotateCcw, Salad,
  ScanLine, Search, Send, Settings, ShieldCheck, SkipForward, Sparkles, Sun, Target, Timer, Trash2, Trophy,
  UserCheck, UserPlus, UserX, Users, Video, X,
} from 'lucide-react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
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

// ---- i18n ----
// A from-scratch translation layer: rather than rewriting every JSX call
// site to use abstract keys, t(fa) looks the existing Persian string up in
// a fa->en dictionary and falls back to the Persian itself when there's no
// entry yet (or when lang is 'fa') — so pages translate incrementally
// without ever showing a raw key or breaking untranslated ones.
const EN_TRANSLATIONS = {
  'تناسب': 'Tanasob',
  // Landing page
  'خانه': 'Home', 'درباره ما': 'About', 'خدمات': 'Services', 'برنامه‌ها': 'Programs', 'تماس با ما': 'Contact',
  'ورود / ثبت‌نام': 'Log in / Sign up',
  'باشگاه ورزشی تناسب': 'Tanasob Sports Club',
  'بهترین نسخه': 'The best version', 'خودت باش': 'of yourself',
  'محیطی حرفه‌ای، مربیان مجرب و برنامه‌های تمرینی متناسب با هدف تو. ما کنارتم تا قوی‌تر، سالم‌تر و پرانرژی‌تر زندگی کنی.':
    'A professional space, experienced trainers, and workout plans built around your goals. We\'re here to help you live stronger, healthier, more energized.',
  'شروع کن': 'Get started', 'تماشای معرفی باشگاه': 'Watch the intro',
  'صاحب باشگاهی؟ باشگاه خودت را در تناسب ثبت کن': 'Own a gym? Register it on Tanasob',
  'چرا تناسب؟': 'Why Tanasob?', 'همه چیز برای رسیدن به هدف تو': 'Everything to reach your goal',
  'نتایج واقعی': 'Real results', 'برنامه‌های علمی و اصولی برای رسیدن به بهترین نتیجه': 'Science-based programs built for real results',
  'مربیان حرفه‌ای': 'Professional trainers', 'مربیان باتجربه و دارای معتبرترین مدارک بین‌المللی': 'Experienced trainers with recognized international certifications',
  'برنامه شخصی‌سازی شده': 'Personalized plans', 'برنامه تمرینی و غذایی متناسب با هدف و شرایط بدنی تو': 'Workout and diet plans tailored to your goals and body',
  'تجهیزات به‌روز': 'Modern equipment', 'مدرن‌ترین دستگاه‌ها و محیطی استاندارد و تمیز': 'The latest machines in a clean, standard-compliant space',
  // Auth pages
  'باشگاه هوشمند شما': 'Your smart gym', 'پلتفرم مدیریت باشگاه‌های ورزشی': 'A management platform for sports gyms',
  'ساخت حساب کاربری': 'Create an account', 'ورود به حساب': 'Log in',
  'اطلاعات خود را وارد کنید.': 'Enter your details.', 'ایمیل و رمز عبور خود را وارد کنید.': 'Enter your email and password.',
  'نام و نام خانوادگی': 'Full name', 'شماره تماس': 'Phone number', 'ایمیل': 'Email', 'رمز عبور': 'Password',
  'تکرار رمز عبور': 'Confirm password', 'باشگاه': 'Gym', 'انتخاب باشگاه': 'Select a gym',
  'نوع حساب': 'Account type', 'عضو باشگاه': 'Member', 'مربی': 'Trainer',
  'لطفاً صبر کنید...': 'Please wait...', 'ساخت حساب': 'Create account', 'ورود به تناسب': 'Log in to Tanasob',
  'حساب کاربری را مدیر باشگاه برایت می‌سازد. اگر هنوز حسابی نداری با باشگاهت تماس بگیر.':
    'Your gym\'s admin creates your account. If you don\'t have one yet, contact your gym.',
  'ورود به حساب': 'Log in',
  'می‌خوای باشگاه خودتو ثبت کنی؟': 'Want to register your own gym?',
  'ثبت باشگاه جدید': 'Register a new gym', 'باشگاه خودت را راه‌اندازی کن': 'Launch your own gym',
  'یک فضای کاملاً مستقل برای باشگاهت با اولین حساب مدیر بساز.': 'Create a fully independent space for your gym, with its first admin account.',
  'نام باشگاه': 'Gym name', 'آدرس': 'Address', 'تلفن باشگاه': 'Gym phone',
  'نام و نام خانوادگی مدیر': "Admin's full name", 'ایمیل مدیر': "Admin's email",
  'ساخت باشگاه': 'Create gym', 'عضو یک باشگاه موجودی؟ ثبت‌نام معمولی': 'Already part of a gym? Regular sign-up',
  // Sidebar / nav
  'کلاس‌ها': 'Classes', 'اشتراک من': 'My subscription', 'کارت عضویت': 'Membership card', 'پیشرفت بدن': 'Body progress',
  'برنامه‌سازی': 'Plan builder', 'تقویم من': 'My calendar', 'گفت‌وگوها': 'Messages',
  'رویدادها': 'Events', 'مسابقات': 'Competitions', 'جدول امتیازات': 'Leaderboard', 'وبلاگ': 'Blog',
  'کتابخانه حرکات': 'Exercise library', 'پنل مربی': 'Trainer panel', 'مدیریت باشگاه': 'Admin panel',
  'اعلان‌ها': 'Notifications', 'پروفایل': 'Profile', 'خروج از حساب': 'Log out', 'سلام،': 'Hi,',
  // Dashboard
  'نمای کلی': 'Overview', 'برنامه امروز شما': "Today's plan", 'وضعیت امروز باشگاه': "Today's gym overview",
  'جلسات، اعلان‌ها و برنامه‌های فعال در یک نگاه.': 'Sessions, notifications, and active plans at a glance.',
  'کلاس‌های پیش رو': 'Upcoming classes', 'برنامه‌های فعال': 'Active plans', 'تمرکز امروز': "Today's focus", '۴ جلسه': '4 sessions',
  'کلاس‌های فعال': 'Active classes', 'اعلان‌های تازه': 'New notifications', 'وضعیت سیستم': 'System status', 'پایدار': 'Stable',
  'جلسات نزدیک': 'Upcoming sessions', 'جای خالی': 'spots left', 'جلسه‌ای برای نمایش نیست.': 'No sessions to show.',
  'آخرین اعلان‌ها': 'Latest notifications', 'اعلان تازه‌ای نداری.': "You don't have any new notifications.",
  'مشاهده همه': 'View all',
}

function translate(lang, fa) {
  if (lang !== 'en') return fa
  return EN_TRANSLATIONS[fa] ?? fa
}

const LanguageContext = createContext({ lang: 'fa', setLang: () => {}, t: (fa) => fa })
const useLang = () => useContext(LanguageContext)

function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem('tanasob_lang') || 'fa')
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'fa'
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'
  }, [lang])
  const setLang = (next) => { localStorage.setItem('tanasob_lang', next); setLangState(next) }
  const t = (fa) => translate(lang, fa)
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

function LanguageToggle({ className = 'icon-button lang-toggle-btn' }) {
  const { lang, setLang } = useLang()
  return <button className={className} onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')} title={lang === 'fa' ? 'English' : 'فارسی'}>
    <Globe size={18} /><span className="lang-toggle-label">{lang === 'fa' ? 'EN' : 'FA'}</span>
  </button>
}

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
  return <LanguageProvider><AppRoutes /></LanguageProvider>
}

function AppRoutes() {
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

  const { lang } = useLang()
  if (!ready) return <div className="boot"><Sparkles /> {lang === 'en' ? 'Preparing Tanasob...' : 'در حال آماده‌سازی تناسب...'}</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage onLogin={login} />} />
      {/* Self-signup is closed: a gym's roster is who actually joined, so
          the admin creates accounts. Registering a whole new GYM is still
          public (/register-gym) — that's how a gym owner onboards. */}
      <Route path="/register" element={<Navigate to="/login" replace />} />
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
  const { t } = useLang()
  return <div className="landing">
    <div className="landing-top">
      <div className="landing-hero-image" style={{ backgroundImage: `url(${landingImage})` }} />
      <header className="landing-nav">
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-auth-btn"><CircleUserRound size={18} /> {t('ورود به حساب')}</Link>
          <LanguageToggle className="landing-lang-toggle" />
        </div>
        <nav className="landing-nav-links">{LANDING_NAV.map((label, index) => <a key={label} href="#" className={index === 0 ? 'active' : ''} onClick={(e) => e.preventDefault()}>{t(label)}</a>)}</nav>
        <div className="landing-logo"><strong>{t('تناسب')}</strong><span><Activity size={18} /></span></div>
      </header>

      <section className="landing-hero">
        <motion.div className="landing-hero-text" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: 'easeOut' }}>
          <p className="landing-eyebrow">{t('باشگاه ورزشی تناسب')}</p>
          <h1>{t('بهترین نسخه')}<br /><span>{t('خودت باش')}</span></h1>
          <p className="landing-hero-desc">{t('محیطی حرفه‌ای، مربیان مجرب و برنامه‌های تمرینی متناسب با هدف تو. ما کنارتم تا قوی‌تر، سالم‌تر و پرانرژی‌تر زندگی کنی.')}</p>
          <div className="landing-cta-row">
            <motion.div whileTap={{ scale: .96 }} whileHover={{ scale: 1.03 }}><Link to="/register" className="landing-btn landing-btn-primary">{t('شروع کن')} <ArrowLeft size={18} /></Link></motion.div>
            <motion.button className="landing-btn landing-btn-ghost" whileTap={{ scale: .96 }} whileHover={{ scale: 1.03 }}><Play size={15} /> {t('تماشای معرفی باشگاه')}</motion.button>
          </div>
          <Link to="/register-gym" className="landing-gym-cta"><Building2 size={15} /> {t('صاحب باشگاهی؟ باشگاه خودت را در تناسب ثبت کن')}</Link>
        </motion.div>
      </section>
    </div>

    <section className="landing-features">
      <p className="landing-eyebrow center">{t('چرا تناسب؟')}</p>
      <h2>{t('همه چیز برای رسیدن به هدف تو')}</h2>
      <div className="landing-features-grid">{LANDING_FEATURES.map(({ icon: Icon, title, text }, i) => <motion.div className="landing-feature" key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: .4, delay: i * .08 }}><span><Icon size={22} /></span><strong>{t(title)}</strong><p>{t(text)}</p></motion.div>)}</div>
    </section>
  </div>
}

function AuthPage({ register, onLogin }) {
  const { t } = useLang()
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
        <div className="auth-tagline"><h1>{t('تناسب')}</h1><p>{t('باشگاه هوشمند شما')}</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-top"><div className="brand-line"><Activity /> <strong>{t('تناسب')}</strong></div><LanguageToggle /></div>
          <h2>{register ? t('ساخت حساب کاربری') : t('ورود به حساب')}</h2>
          <p>{register ? t('اطلاعات خود را وارد کنید.') : t('ایمیل و رمز عبور خود را وارد کنید.')}</p>
          <form onSubmit={submit} className="form-grid">
            {register && <><Field label={t('نام و نام خانوادگی')} value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} required />
              <Field label={t('شماره تماس')} value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /></>}
            <Field label={t('ایمیل')} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
            <Field label={t('رمز عبور')} type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
            {register && <><Field label={t('تکرار رمز عبور')} type="password" value={form.password2} onChange={(password2) => setForm({ ...form, password2 })} required />
              <label>{t('باشگاه')}<select value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} required>
                <option value="">{t('انتخاب باشگاه')}</option>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select></label>
              <label>{t('نوع حساب')}<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="MEMBER">{t('عضو باشگاه')}</option><option value="TRAINER">{t('مربی')}</option></select></label></>}
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? t('لطفاً صبر کنید...') : register ? t('ساخت حساب') : t('ورود به تناسب')} <ChevronLeft size={18} /></button>
          </form>
          <p className="auth-note">{t('حساب کاربری را مدیر باشگاه برایت می‌سازد. اگر هنوز حسابی نداری با باشگاهت تماس بگیر.')}</p>
          {register && <Link to="/register-gym" className="text-button"><Building2 size={15} /> {t('می‌خوای باشگاه خودتو ثبت کنی؟')}</Link>}
        </div>
      </section>
    </main>
  )
}

function RegisterGymPage({ onLogin }) {
  const { t } = useLang()
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
        <div className="auth-tagline"><h1>{t('تناسب')}</h1><p>{t('پلتفرم مدیریت باشگاه‌های ورزشی')}</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-top"><div className="brand-line"><Building2 /> <strong>{t('ثبت باشگاه جدید')}</strong></div><LanguageToggle /></div>
          <h2>{t('باشگاه خودت را راه‌اندازی کن')}</h2>
          <p>{t('یک فضای کاملاً مستقل برای باشگاهت با اولین حساب مدیر بساز.')}</p>
          <form onSubmit={submit} className="form-grid">
            <Field label={t('نام باشگاه')} value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <Field label={t('آدرس')} value={form.address} onChange={(address) => setForm({ ...form, address })} />
            <Field label={t('تلفن باشگاه')} value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            <Field label={t('نام و نام خانوادگی مدیر')} value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} required />
            <Field label={t('ایمیل مدیر')} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
            <Field label={t('رمز عبور')} type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
            <Field label={t('تکرار رمز عبور')} type="password" value={form.password2} onChange={(password2) => setForm({ ...form, password2 })} required />
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? t('لطفاً صبر کنید...') : t('ساخت باشگاه')} <ChevronLeft size={18} /></button>
          </form>
          <button className="text-button" onClick={() => navigate('/register')}>{t('عضو یک باشگاه موجودی؟ ثبت‌نام معمولی')}</button>
        </div>
      </section>
    </main>
  )
}

/** Switches the theme as a circular wipe that grows out of the button you
 *  actually pressed, using the View Transitions API.
 *
 *  The whole thing degrades to a plain instant switch when the browser has
 *  no startViewTransition (Firefox, older Safari) or when the user asked
 *  for reduced motion — a full-screen wipe is exactly the kind of movement
 *  that setting exists to suppress. */
function useThemeTransition(theme, setTheme) {
  const busy = useRef(false)
  return (event) => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) return setTheme(next)
    // A second click mid-sweep makes the browser abandon the first
    // transition, which leaves the wipe half-drawn over the new palette.
    if (busy.current) return
    busy.current = true

    // Origin = the button's centre, so the new theme appears to pour out of
    // the thing the user touched.
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

    document.documentElement.style.setProperty('--theme-x', `${x}px`)
    document.documentElement.style.setProperty('--theme-y', `${y}px`)
    document.documentElement.style.setProperty('--theme-r', `${radius}px`)

    const transition = document.startViewTransition(() => {
      // The attribute is written here, by hand, rather than left to the
      // useEffect that normally owns it. useEffect is a passive effect, so
      // React is free to run it after this callback returns — and by then
      // the browser has already snapshotted the "new" state, capturing the
      // OLD palette. The wipe would reveal the colours it started with and
      // the real theme would land a frame later as a jump.
      document.documentElement.dataset.theme = next
      flushSync(() => setTheme(next))
    })
    // ready/finished REJECT when the browser skips the transition — a
    // background tab, or a second toggle aborting this one. Both need a
    // catch or every skipped switch logs an unhandled rejection; .finally()
    // is not enough on its own, it re-throws what it was handed.
    transition.ready.catch(() => null).then((skipped) => {
      if (skipped === null) return
      // Only the new layer moves. The old one is held still underneath by
      // CSS (animation: none) and is fully covered by the time the circle
      // reaches the far corner, so there is nothing to fade — fading it
      // just opens a gap that shows the page background through both.
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(.32,.72,.34,1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    transition.finished.catch(() => {}).then(() => { busy.current = false })
  }
}

function Shell({ user, setUser, logout, theme, setTheme }) {
  const { t } = useLang()
  const toggleTheme = useThemeTransition(theme, setTheme)
  const member = user.role === 'MEMBER', trainer = user.role === 'TRAINER', admin = user.role === 'ADMIN'
  const nav = [
    ['/', 'خانه', LayoutDashboard],
    // Second on purpose: the mobile bar only shows the first five, and the
    // calendar is the surface a member opens the app for.
    ['/calendar', admin || trainer ? 'تقویم باشگاه' : 'تقویم من', CalendarDays],
    ...(trainer ? [['/plan-builder', 'برنامه‌سازی', ClipboardList]] : []),
    ['/classes', 'کلاس‌ها', CalendarDays],
    ...(member ? [['/goals', 'اهداف من', Target], ['/membership', 'اشتراک من', CreditCard], ['/card', 'کارت عضویت', QrCode], ['/progress', 'پیشرفت بدن', Activity]] : []),
    ...(!admin ? [['/messages', 'گفت‌وگوها', MessageCircle]] : []),
    ['/events', 'رویدادها', CalendarRange],
    ['/competitions', 'مسابقات', Trophy],
    ['/trainers', 'مربیان', Users],
    ['/blog', 'وبلاگ', Newspaper],
    // Tiers, points and plan discounts only ever apply to members — a
    // trainer has no subscription to discount and no rank to earn.
    ...(member || admin ? [['/leaderboard', 'جدول امتیازات', Award]] : []),
    ...(trainer || admin ? [['/exercises', 'کتابخانه حرکات', Dumbbell]] : []),
    ...(trainer ? [['/trainer', 'پنل مربی', Users]] : []),
    ...(admin ? [['/admin', 'مدیریت باشگاه', ShieldCheck]] : []),
    ['/notifications', 'اعلان‌ها', Bell],
    ['/profile', 'پروفایل', CircleUserRound],
  ]
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><span><Activity /></span><strong>{user.organization?.name || t('تناسب')}</strong></div>
        <nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20} />{t(label)}</NavLink>)}</nav>
        <button className="sidebar-bottom" onClick={logout}><LogOut size={18} /> {t('خروج از حساب')}</button>
      </aside>
      <div className="mobile-nav">{nav.slice(0, 5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={18} /><span>{t(label)}</span></NavLink>)}</div>
      <main className="workspace">
        <header className="topbar"><div><h1>{t('سلام،')} {user.full_name?.split(' ')[0]} 👋</h1></div><div className="top-actions"><LanguageToggle /><button className="icon-button" onClick={toggleTheme} title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><NavLink className="icon-button" to="/notifications"><Bell size={19} /></NavLink></div></header>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/membership" element={member ? <Memberships /> : <Navigate to="/" />} />
            <Route path="/card" element={member ? <MembershipCard user={user} /> : <Navigate to="/" />} />
            <Route path="/classes" element={<Classes user={user} />} />
            <Route path="/classes/:id" element={<ClassDetailPage user={user} />} />
            <Route path="/trainers" element={<TrainersPage />} />
            <Route path="/trainers/:id" element={<TrainerProfilePage user={user} />} />
            <Route path="/u/:id" element={<MemberProfilePage />} />
            <Route path="/calendar" element={<MyCalendarPage user={user} />} />
            <Route path="/plan-builder" element={trainer ? <TrainerPlans user={user} /> : <Navigate to="/" />} />
            {/* The page was called "برنامه‌های من" at /plans before it became a
                calendar; keep old links and bookmarks working. */}
            <Route path="/plans" element={<Navigate to="/calendar" replace />} />
            <Route path="/workout/:planId/:dayId" element={member ? <WorkoutRunPage /> : <Navigate to="/" />} />
            <Route path="/walk" element={member ? <WalkPage /> : <Navigate to="/" />} />
            <Route path="/progress" element={member ? <Progress /> : <Navigate to="/" />} />
            <Route path="/goals" element={member ? <GoalsPage /> : <Navigate to="/" />} />
            <Route path="/messages" element={!admin ? <Messages user={user} /> : <Navigate to="/" />} />
            <Route path="/notifications" element={<Notifications user={user} />} />
            <Route path="/leaderboard" element={<Leaderboard user={user} />} />
            <Route path="/events" element={<EventsPage user={user} />} />
            <Route path="/competitions" element={<Competitions user={user} />} />
            <Route path="/blog" element={<BlogPage user={user} />} />
            <Route path="/blog/:slug" element={<BlogPostDetail user={user} />} />
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
  const { t } = useLang()
  const [data, setData] = useState({ sessions: [], plans: [], notices: [] })
  const [points, setPoints] = useState(null)
  const [goals, setGoals] = useState(null)
  const [calorieSummary, setCalorieSummary] = useState(null)
  const [coach, setCoach] = useState(null)
  // "تمرکز امروز: ۴ جلسه" used to be a hardcoded string — it showed 4 to
  // every trainer, always. Replaced with their real active-student count.
  const [trainerStudents, setTrainerStudents] = useState(0)
  const [events, setEvents] = useState([])
  useEffect(() => {
    Promise.all([api.get('/sessions/'), api.get('/notifications/'), ...(user.role !== 'ADMIN' ? [api.get('/workout-plans/')] : [])]).then((responses) => setData({
      sessions: getItems(responses[0].data).slice(0, 4), notices: getItems(responses[1].data).slice(0, 3), plans: responses[2] ? getItems(responses[2].data) : [],
    })).catch(() => {})
    if (user.role === 'MEMBER') {
      api.get('/progress/me/points/').then(({ data }) => setPoints(data)).catch(() => {})
      api.get('/progress/me/goals/').then(({ data }) => setGoals(data)).catch(() => {})
      api.get('/activities/summary/').then(({ data }) => setCalorieSummary(data)).catch(() => {})
      api.get('/progress/me/coach/').then(({ data }) => setCoach(data)).catch(() => {})
    }
    if (user.role === 'TRAINER') {
      api.get('/auth/assignments/').then(({ data }) => setTrainerStudents(getItems(data).filter((a) => a.status === 'ACTIVE').length)).catch(() => {})
    }
    api.get('/events/').then(({ data }) => setEvents(getItems(data).filter((e) => e.days_remaining >= 0).slice(0, 5))).catch(() => {})
  }, [user.role])
  const metrics = user.role === 'MEMBER' ? [['کلاس‌های پیش رو', data.sessions.length, CalendarDays, 'blue'], ['برنامه‌های فعال', data.plans.length, ClipboardList, 'purple']] : user.role === 'TRAINER' ? [['جلسات این هفته', data.sessions.length, CalendarDays, 'blue'], ['برنامه‌های فعال', data.plans.length, ClipboardList, 'purple'], ['شاگردان من', trainerStudents, Users, 'orange']] : [['کلاس‌های فعال', data.sessions.length, CalendarDays, 'blue'], ['اعلان‌های تازه', data.notices.length, Bell, 'pink'], ['وضعیت سیستم', 'پایدار', ShieldCheck, 'green']]
  return <section className="page-stack">
    {events.length ? <EventHeroSlider events={events} /> : (
      <motion.section className="hero-card " initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}><div><p className="eyebrow">{t('نمای کلی')}</p><h2>{t(user.role === 'MEMBER' ? 'برنامه امروز شما' : 'وضعیت امروز باشگاه')}</h2><p>{t('جلسات، اعلان‌ها و برنامه‌های فعال در یک نگاه.')}</p></div><div className="hero-graphic"><Dumbbell size={45} /></div></motion.section>
    )}
    <section className="metric-grid">{metrics.map(([label, value, Icon, color], i) => <motion.article className={`metric-card metric-card--${color}`} key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .06 }}><span className="icon-chip on-tile"><Icon size={20} /></span><p>{t(label)}</p><strong>{value}</strong></motion.article>)}</section>
    {coach && <CoachCard data={coach} />}
    {user.role === 'MEMBER' && <TodayCard plans={data.plans} />}
    {points && <PointsCard points={points} />}
    {goals && <GoalsCard goals={goals} burnedToday={calorieSummary?.today_calories} />}
    {calorieSummary && <CaloriesBurnedCard summary={calorieSummary} />}
    <section className="content-grid"><Card title={t('جلسات نزدیک')} action="/classes">{data.sessions.length ? data.sessions.map((session) => <div className="list-row" key={session.id}><div className="date-chip"><b>{formatDate(session.session_date)}</b></div><div><strong>{session.gym_class_name}</strong><small>{session.trainer_name} · {session.start_time?.slice(0, 5)}</small></div>{user.role !== 'MEMBER' && <span className="capacity">{session.remaining_capacity} {t('جای خالی')}</span>}</div>) : <Empty text={t('جلسه‌ای برای نمایش نیست.')} />}</Card><Card title={t('آخرین اعلان‌ها')} action="/notifications">{data.notices.length ? data.notices.map((notice) => <div className="list-row" key={notice.id}><span className="notice-dot" /><div><strong>{notice.title}</strong><small>{notice.message}</small></div></div>) : <Empty text={t('اعلان تازه‌ای نداری.')} />}</Card></section></section>
}

const COACH_ICONS = { trophy: Trophy, card: CreditCard, flame: Flame, award: Award, target: Target, check: CheckCircle2 }

/** The daily nudge + checklist.
 *
 *  Nothing here is a stored to-do: the server derives each task from real
 *  records, so an item ticks itself the moment you actually do the thing.
 *  That's why the boxes are read-only — pressing one would be pretending. */
function CoachCard({ data }) {
  const navigate = useNavigate()
  const top = data.suggestions?.[0]
  const Icon = top ? (COACH_ICONS[top.icon] || Target) : Target

  return <motion.section className="coach-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .05 }}>
    {top && (
      <div className={`coach-nudge tone-${top.tone}`}>
        <span className="coach-nudge-icon"><Icon size={20} /></span>
        {/* The server builds these strings with Python's own numerals, so
            the digits are Latin by the time they arrive. Convert on render
            rather than in the backend — keeps the API locale-neutral and
            matches every other number in the UI. */}
        <p>{toPersianDigits(top.text)}</p>
        {top.action && <button className="button muted" onClick={() => navigate(top.action)}>{top.action_label}</button>}
      </div>
    )}

    <div className="coach-tasks">
      <div className="coach-tasks-head">
        <p className="eyebrow">کارهای امروز</p>
        <span className="coach-progress-label">{toPersianDigits(data.done)} از {toPersianDigits(data.total)}</span>
      </div>
      <div className="coach-progress"><motion.div initial={{ width: 0 }} animate={{ width: `${data.percent}%` }} transition={{ duration: .6, ease: 'easeOut' }} /></div>
      <div className="coach-task-list">
        {data.tasks.map((task) => (
          <button className={`coach-task ${task.done ? 'done' : ''}`} key={task.key} onClick={() => task.action && navigate(task.action)}>
            <span className="coach-task-box">{task.done && <Check size={13} />}</span>
            <span className="coach-task-body"><strong>{toPersianDigits(task.label)}</strong><small>{toPersianDigits(task.hint)}</small></span>
            {!task.done && <ChevronLeft size={15} />}
          </button>
        ))}
      </div>
    </div>
  </motion.section>
}

/** The dashboard's "get moving" card: today's workout straight from the
 * member's plan, one tap from actually running it, plus the shortcuts to
 * the full calendar and a walk. Deliberately sits directly under the stat
 * tiles — this is the thing a member opens the app to do. */
function TodayCard({ plans }) {
  const navigate = useNavigate()
  const today = todayIso()
  const match = plans
    .filter((p) => !p.is_archived)
    .flatMap((plan) => (plan.days || []).map((day) => ({ plan, day })))
    .find(({ day }) => day.date === today)

  return <motion.section className="today-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .08 }}>
    <div className="today-card-main">
      <p className="eyebrow">تمرین امروز</p>
      {match ? (
        <>
          <h3>{match.day.label || 'برنامه امروز آماده است'}</h3>
          <p className="today-card-sub">{toPersianDigits(match.day.items.length)} حرکت · {match.plan.title}</p>
          <div className="today-card-exercises">
            {match.day.items.slice(0, 4).map((it) => <span key={it.id}>{it.exercise_name}</span>)}
            {match.day.items.length > 4 && <span className="more">+{toPersianDigits(match.day.items.length - 4)}</span>}
          </div>
        </>
      ) : (
        <>
          <h3>امروز تمرینی ثبت نشده</h3>
          <p className="today-card-sub">می‌تونی تقویمت رو ببینی یا یه پیاده‌روی بزنی.</p>
        </>
      )}
    </div>
    <div className="today-card-actions">
      {match && <button className="button primary" onClick={() => navigate(`/workout/${match.plan.id}/${match.day.id}`)}><Play size={16} /> شروع تمرین</button>}
      <button className="button muted" onClick={() => navigate('/calendar')}><CalendarDays size={16} /> تقویم من</button>
      <button className="button muted" onClick={() => navigate('/walk')}><MapPin size={16} /> پیاده‌روی</button>
    </div>
  </motion.section>
}

/** Weekly/monthly attendance goals (real Attendance counts vs a sensible
 * fixed target) plus today's calorie target pulled from the member's diet
 * plan — three radial gauges, one row. */

/** The member's own goals page: set the targets, see progress against them.
 *
 *  The targets used to be constants shared by every member — the same four
 *  sessions a week for someone training twice and someone training six
 *  times. These are theirs. */
function GoalsPage() {
  const [goals, setGoals] = useState(null)
  const [settings, setSettings] = useState(null)
  const [summary, setSummary] = useState(null)
  const [points, setPoints] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => Promise.all([
    api.get('/progress/me/goals/'), api.get('/progress/me/goal-settings/'),
    api.get('/activities/summary/'), api.get('/progress/me/points/'),
  ]).then(([g, s, a, p]) => { setGoals(g.data); setSettings(s.data); setSummary(a.data); setPoints(p.data) })
    .catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.patch('/progress/me/goal-settings/', settings)
      setMessage('اهداف ذخیره شد.')
      load()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }

  if (!goals || !settings) return <section className="page-stack"><Message text={message} />{!message && <Empty text="در حال بارگذاری..." />}</section>

  const set = (patch) => setSettings({ ...settings, ...patch })
  const ring = (value, target, tone) => {
    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0
    const r = 42, c = 2 * Math.PI * r
    return { pct, r, c, offset: c - (pct / 100) * c, tone }
  }
  const cards = [
    { label: 'هدف هفتگی', unit: 'جلسه', ...ring(goals.weekly.count, goals.weekly.target, 'glaze'), value: goals.weekly.count, target: goals.weekly.target },
    { label: 'هدف ماهانه', unit: 'جلسه', ...ring(goals.monthly.count, goals.monthly.target, 'plum'), value: goals.monthly.count, target: goals.monthly.target },
    { label: 'کالری امروز', unit: 'کالری', ...ring(summary?.today_calories || 0, goals.burn_target, 'saffron'), value: summary?.today_calories || 0, target: goals.burn_target },
  ]

  return <section className="page-stack">
    <PageTitle title="اهداف من" text="هدف‌هایت را خودت تعیین کن و پیشرفتت را دنبال کن." />
    <Message text={message} />

    <div className="goal-ring-grid">
      {cards.map((c) => (
        <div className={`goal-ring-card tone-${c.tone}`} key={c.label}>
          <svg viewBox="0 0 100 100">
            <circle className="goal-ring-track" cx="50" cy="50" r={c.r} />
            <motion.circle className="goal-ring-fill" cx="50" cy="50" r={c.r}
              strokeDasharray={c.c} initial={{ strokeDashoffset: c.c }} animate={{ strokeDashoffset: c.offset }}
              transition={{ duration: .9, ease: 'easeOut' }} />
          </svg>
          <div className="goal-ring-label">
            <strong>{toPersianDigits(c.pct)}٪</strong>
            <small>{toPersianDigits(c.value)} از {toPersianDigits(c.target)}</small>
          </div>
          <p>{c.label}</p>
        </div>
      ))}
    </div>

    <Card title="تنظیم اهداف">
      <form onSubmit={save} className="form-grid two">
        <label>جلسه در هفته
          <input type="number" min="1" max="14" value={settings.weekly_sessions} onChange={(e) => set({ weekly_sessions: e.target.value })} />
        </label>
        <label>جلسه در ماه
          <input type="number" min="1" max="60" value={settings.monthly_sessions} onChange={(e) => set({ monthly_sessions: e.target.value })} />
        </label>
        <label>کالری سوزاندن روزانه
          <input type="number" min="0" max="3000" step="50" value={settings.daily_calories} onChange={(e) => set({ daily_calories: e.target.value })} />
        </label>
        <label>وزن هدف (کیلوگرم)
          <input type="number" min="30" max="250" step="0.1" value={settings.target_weight_kg || ''} onChange={(e) => set({ target_weight_kg: e.target.value || null })} />
        </label>
        <label className="goal-note-field">یادداشت انگیزشی
          <input value={settings.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="مثلاً: آماده‌سازی برای مسابقه" />
        </label>
        <button className="button primary" disabled={busy}><Check size={16} /> ذخیره اهداف</button>
      </form>
    </Card>

    <div className="content-grid">
      <Card title="خلاصه فعالیت">
        <div className="list-row"><span className="icon-chip orange"><Flame size={16} /></span><div><strong>{toPersianDigits(summary?.today_calories || 0)} کالری</strong><small>سوزانده‌شده امروز</small></div></div>
        <div className="list-row"><span className="icon-chip blue"><Flame size={16} /></span><div><strong>{toPersianDigits(summary?.week_calories || 0)} کالری</strong><small>این هفته</small></div></div>
        {!!goals.calorie_target && <div className="list-row"><span className="icon-chip green"><Salad size={16} /></span><div><strong>{toPersianDigits(goals.calorie_target)} کالری</strong><small>هدف دریافت روزانه از برنامه غذایی</small></div></div>}
        {goals.target_weight_kg && <div className="list-row"><span className="icon-chip purple"><Target size={16} /></span><div><strong>{toPersianDigits(goals.target_weight_kg)} کیلوگرم</strong><small>وزن هدف</small></div></div>}
      </Card>
      <Card title="امتیاز و سطح">
        {points && <>
          <div className="list-row"><span className="points-tier-emoji">{points.tier_emoji}</span><div><strong>{toPersianDigits(points.points)} امتیاز</strong><small>سطح {points.tier}</small></div></div>
          {points.next_tier && <p className="points-next">{toPersianDigits(points.next_tier.sessions_needed)} جلسه تا سطح {points.next_tier.tier} {points.next_tier.tier_emoji} — {toPersianDigits(points.next_tier.discount)}٪ تخفیف</p>}
          <div className="list-row"><span className="icon-chip blue"><CalendarDays size={16} /></span><div><strong>{toPersianDigits(points.attendance_count)} حضور</strong><small>مجموع کل</small></div></div>
        </>}
      </Card>
    </div>
  </section>
}

function GoalsCard({ goals, burnedToday }) {
  const navigate = useNavigate()
  const rows = [
    { key: 'weekly', label: 'جلسه این هفته', value: goals.weekly.count, target: goals.weekly.target, unit: 'جلسه', tone: 'glaze' },
    { key: 'monthly', label: 'جلسه این ماه', value: goals.monthly.count, target: goals.monthly.target, unit: 'جلسه', tone: 'plum' },
    { key: 'burn', label: 'کالری سوزانده امروز', value: burnedToday ?? 0, target: goals.burn_target, unit: 'کالری', tone: 'saffron' },
  ]
  return <Card title="اهداف من" actionButton={<button className="text-button" onClick={() => navigate('/goals')}>تنظیم اهداف</button>}>
    {goals.note && <p className="goal-note">« {goals.note} »</p>}
    <div className="goal-bars">
      {rows.map((r) => {
        const pct = r.target ? Math.min(100, Math.round((r.value / r.target) * 100)) : 0
        const done = pct >= 100
        return <div className={`goal-bar-row tone-${r.tone} ${done ? 'done' : ''}`} key={r.key}>
          <div className="goal-bar-head">
            <span>{r.label}</span>
            <strong>{toPersianDigits(r.value)}<i> / {toPersianDigits(r.target)} {r.unit}</i></strong>
          </div>
          <div className="goal-bar-track">
            <motion.div className="goal-bar-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .7, ease: 'easeOut' }} />
          </div>
          <small>{done ? 'رسیدی 🎉' : `${toPersianDigits(100 - pct)}٪ باقی مانده`}</small>
        </div>
      })}
    </div>
    {!!goals.calorie_target && <p className="goal-intake">هدف دریافت روزانه از برنامه غذایی: <strong>{toPersianDigits(goals.calorie_target)}</strong> کالری</p>}
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
            <stop offset="0%" stopColor="#b4552f" stopOpacity={.4} />
            <stop offset="100%" stopColor="#b4552f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => [`${v} کالری`, '']} />
        <Area type="monotone" dataKey="calories" stroke="#b4552f" strokeWidth={2} fill="url(#calorieFill)" dot={{ r: 3, fill: '#b4552f', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer></div>
  </Card>
}

const TIER_LADDER = [
  { label: 'برنزی', emoji: '🥉', sessions: 36, discount: 3 },
  { label: 'نقره‌ای', emoji: '🥈', sessions: 72, discount: 7 },
  { label: 'طلایی', emoji: '🥇', sessions: 144, discount: 10 },
  { label: 'الماس', emoji: '💎', sessions: 288, discount: 15 },
]

function PointsCard({ points }) {
  const nt = points.next_tier
  // Progress toward the next tier is measured in sessions now, because that
  // is what the tier is actually earned with.
  const progressPct = nt
    ? Math.min(100, Math.round((points.attendance_count / (points.attendance_count + nt.sessions_needed)) * 100))
    : 100
  return <motion.section className="points-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .1 }}>
    <div className="points-card-top">
      <span className="points-tier-emoji">{points.tier_emoji}</span>
      <div>
        <strong>سطح {points.tier}</strong>
        <small>{toPersianDigits(points.attendance_count)} جلسه حضور · {toPersianDigits(points.points)} امتیاز</small>
      </div>
      <Link to="/leaderboard" className="text-button">جدول امتیازات</Link>
    </div>
    <div className="points-bar"><motion.div className="points-bar-fill" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: .6, ease: 'easeOut' }} /></div>
    {nt
      ? <small className="points-next">{toPersianDigits(nt.sessions_needed)} جلسه تا سطح {nt.tier} {nt.tier_emoji} — {toPersianDigits(nt.discount)}٪ تخفیف اشتراک</small>
      : <small className="points-next">بالاترین سطح را داری 💎</small>}
    {!!points.tier_discount && <small className="points-next tier-perk">هم‌اکنون {toPersianDigits(points.tier_discount)}٪ تخفیف دائمی روی اشتراک داری</small>}
  </motion.section>
}

// Must mirror LEADERBOARD_REWARDS in progress/views.py — rank -> one-time prize.
const LEADERBOARD_REWARD_PERCENTS = { 1: 15, 2: 10, 3: 5 }

function Leaderboard({ user }) {
  const admin = user.role === 'ADMIN'
  const [rows, setRows] = useState([]); const [myId, setMyId] = useState(null); const [message, setMessage] = useState('')
  const [granting, setGranting] = useState(false)
  const [history, setHistory] = useState([])
  const load = () => {
    api.get('/progress/leaderboard/').then(({ data }) => { setRows(data.leaderboard); setMyId(data.my_member_id) }).catch((e) => setMessage(errorMessage(e)))
    api.get('/progress/leaderboard/history/').then(({ data }) => setHistory(data.periods)).catch(() => {})
  }
  useEffect(() => { load() }, [])
  const grantRewards = async () => {
    setGranting(true)
    try {
      const { data } = await api.post('/progress/leaderboard/grant-rewards/')
      setMessage(data.granted.length
        ? `جایزه اهدا شد: ${data.granted.map((g) => `${g.member_name} (${g.percent}٪)`).join('، ')}`
        : 'سه نفر برتر همین الان یک جایزه تخفیف فعال دارند.')
    } catch (e) { setMessage(errorMessage(e)) } finally { setGranting(false) }
  }
  return <section className="page-stack"><PageTitle title="جدول امتیازات" text="امتیاز از حضور در کلاس‌ها، ثبت پیشرفت بدن و داشتن اشتراک فعال به‌دست می‌آید." /><Message text={message} />
    {admin && <Card title="جایزه لیدربورد">
      <p className="reward-hint">سه نفر برتر فعلی جایزه می‌گیرند: نفر اول ۱۵٪، دوم ۱۰٪، سوم ۵٪ تخفیف روی یک خرید — و پس از آن ۳٪ / ۲٪ / ۱٪ تخفیف دائمی. هر زمان که خواستی (مثلاً پایان ماه) این دکمه را بزن.</p>
      <button className="button primary" disabled={granting} onClick={grantRewards}><Award size={16} /> اهدای جایزه به سه نفر برتر</button>
    </Card>}
    <Card title="سطح‌های عضویت و تخفیف">
      <p className="reward-hint">سطحت با تعداد جلساتی که واقعاً آمده‌ای بالا می‌رود و هر سطح یک تخفیف دائمی روی اشتراک دارد.</p>
      <div className="tier-ladder">
        {TIER_LADDER.map((t) => (
          <div className="tier-step" key={t.label}>
            <span className="tier-emoji">{t.emoji}</span>
            <strong>{t.label}</strong>
            <small>{toPersianDigits(t.sessions)} جلسه</small>
            <span className="tier-discount">{toPersianDigits(t.discount)}٪</span>
          </div>
        ))}
      </div>
      <p className="reward-hint tier-foot">جایزه سه نفر برتر هر دوره جداگانه است: نفر اول ۱۵٪، دوم ۱۰٪، سوم ۵٪ برای یک خرید — و بعد از آن ۳٪ / ۲٪ / ۱٪ تخفیف دائمی. تخفیف‌ها با هم جمع نمی‌شوند؛ بیشترین مورد اعمال می‌شود.</p>
    </Card>
    <Card title="رتبه‌بندی اعضا">
      {rows.length ? rows.map((row, i) => <motion.div className={`leaderboard-row ${row.member_id === myId ? 'me' : ''}`} key={row.member_id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .25, delay: i * .03 }}>
        <span className={`rank-badge rank-${row.rank <= 3 ? row.rank : 'other'}`}>{row.rank}</span>
        <div><Link className="trainer-link" to={`/u/${row.member_id}`}><strong>{row.full_name}</strong></Link><small>{row.attendance_count} حضور</small></div>
        {LEADERBOARD_REWARD_PERCENTS[row.rank] && <span className="reward-tag">🎁 {LEADERBOARD_REWARD_PERCENTS[row.rank]}٪</span>}
        <span className="points-tier-emoji small">{row.tier_emoji}</span>
        <strong className="capacity">{row.points} امتیاز</strong>
      </motion.div>) : <Empty text="هنوز داده‌ای برای رتبه‌بندی وجود ندارد." />}
    </Card>
    {!!history.length && <Card title="نفرات برتر دوره‌های قبل">
      {history.map((period) => (
        <div className="history-period" key={period.granted_on}>
          <p className="eyebrow">{formatDate(period.granted_on)}</p>
          <div className="history-winners">
            {period.winners.map((w) => (
              <div className={`history-winner ${w.is_me ? 'me' : ''}`} key={`${period.granted_on}-${w.member_id}`}>
                <span className={`rank-badge rank-${w.rank}`}>{toPersianDigits(w.rank)}</span>
                <div><strong>{w.full_name}</strong><small>{toPersianDigits(w.percent)}٪ تخفیف</small></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>}
  </section>
}

function Memberships() {
  const [plans, setPlans] = useState([]); const [subscriptions, setSubscriptions] = useState([]); const [rewards, setRewards] = useState([]); const [message, setMessage] = useState('')
  const [discount, setDiscount] = useState(null)
  const load = () => Promise.all([api.get('/plans/'), api.get('/subscriptions/me/'), api.get('/rewards/me/'), api.get('/discount/me/')]).then(([a, b, c, d]) => { setPlans(getItems(a.data)); setSubscriptions(getItems(b.data)); setRewards(getItems(c.data)); setDiscount(d.data) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const activeReward = rewards.find((r) => !r.is_redeemed)
  const subscribe = async (plan) => {
    try {
      const { data } = await api.post('/subscribe/', { plan: plan.id })
      const paid = Number(data.payment.amount)
      setMessage(paid < Number(plan.price) ? `اشتراک با تخفیف جایزه لیدربورد فعال شد! مبلغ پرداختی: ${formatPrice(paid)}` : 'اشتراک شما با موفقیت فعال شد.')
      load()
    } catch (e) { setMessage(errorMessage(e)) }
  }
  const cancelSubscription = async (id) => { try { await api.post(`/subscriptions/${id}/cancel/`); setMessage('اشتراک لغو شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  return <section className="page-stack"><PageTitle title="اشتراک باشگاه" text="پلنی را انتخاب کن که با ریتم تمرینت هماهنگ است." /><Message text={message} />
    {activeReward && <div className="reward-banner"><Trophy size={20} /><div>
      <strong>چون رتبه {toPersianDigits(String(activeReward.rank))} جدول امتیازات شدی، {toPersianDigits(String(activeReward.percent))}٪ تخفیف داری 🎉</strong>
      <small>این جایزه بابت دوره‌ای است که در {formatDate(activeReward.granted_at)} بسته شد. تخفیف روی اولین اشتراکی که بخری خودکار اعمال می‌شود — کاری لازم نیست بکنی.</small>
    </div></div>}
    {!activeReward && !!rewards.length && (
      <p className="reward-hint reward-used-note">
        <Trophy size={14} /> آخرین جایزه‌ات ({toPersianDigits(String(rewards[0].percent))}٪ بابت رتبه {toPersianDigits(String(rewards[0].rank))}) قبلاً استفاده شده است.
      </p>
    )}
    <div className="plan-grid">{plans.map((plan, index) => {
      // With a reward in hand the sticker price is not what they'll pay, so
      // show both: the original struck through, the real one beneath it.
      const pct = discount?.percent || 0
      const discounted = pct ? Math.round(Number(plan.price) * (100 - pct) / 100) : null
      return <article className={`plan-card  ${index === 1 ? 'featured' : ''}`} key={plan.id}>
        {index === 1 && <span className="pill">پیشنهاد تناسب</span>}
        <p>{plan.duration_days} روز دسترسی</p>
        <h2>{plan.name}</h2>
        {discounted !== null ? <div className="plan-price-block">
          <span className="plan-price-old">{formatPrice(plan.price)}</span>
          <strong>{formatPrice(discounted)}</strong>
          <span className="plan-price-badge">{toPersianDigits(pct)}٪ — {discount.label}</span>
        </div> : <strong>{formatPrice(plan.price)}</strong>}
        <small>{plan.description}</small>
        <button className="button primary" onClick={() => subscribe(plan)}>انتخاب پلن <ChevronLeft size={17} /></button>
      </article>
    })}</div><Card title="اشتراک‌های من">{subscriptions.map((subscription) => <div className="list-row" key={subscription.id}><Status value={subscription.status} /><div><strong>{subscription.plan_name}</strong><small>تا {formatDate(subscription.end_date)}</small></div>{subscription.status === 'ACTIVE' && <button className="button muted" onClick={() => cancelSubscription(subscription.id)}>لغو اشتراک</button>}</div>) || <Empty text="هنوز اشتراکی ثبت نشده است." />}</Card></section>
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
  const [openId, setOpenId] = useState(null)
  const load = () => {
    const calls = [api.get('/sessions/'), api.get('/classes/')]
    if (user.role === 'MEMBER') calls.push(api.get('/bookings/'), api.get('/attendance/'))
    if (admin) calls.push(api.get('/auth/trainers/'))
    return Promise.all(calls).then((results) => {
      setSessions(getItems(results[0].data))
      setClasses(getItems(results[1].data))
      if (user.role === 'MEMBER') {
        setBookings(getItems(results[2].data))
        setAttendance(getItems(results[3].data))
      }
      if (admin) {
        setTrainers(getItems(results[2].data))
      }
    }).catch((e) => setMessage(errorMessage(e)))
  }
  useEffect(() => { load() }, [user.role])
  const book = async (id) => { try { await api.post('/bookings/', { session: id }); setMessage('رزرو با موفقیت ثبت شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const cancel = async (id) => { try { await api.post(`/bookings/${id}/cancel/`); setMessage('رزرو لغو شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const selfCheckIn = async (sessionId) => { try { await api.post('/attendance/check-in/', { session: sessionId }); setMessage('حضورت ثبت شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const openSession = sessions.find((s) => s.id === openId) || null
  const openClass = openSession ? classes.find((c) => c.id === openSession.gym_class) : null

  // One card per CLASS, not per session. The API returns every upcoming
  // session (88 of them across 6 classes), so listing them raw made the
  // page look like a wall of duplicates. Each class shows its next session
  // — the one you'd actually book — and links to its own page for the rest.
  const byClass = useMemo(() => {
    const map = new Map()
    sessions.forEach((session) => {
      const list = map.get(session.gym_class) || []
      list.push(session)
      map.set(session.gym_class, list)
    })
    return [...map.entries()].map(([classId, list]) => {
      const sorted = [...list].sort((a, b) =>
        (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time))
      return { gymClass: classes.find((c) => c.id === classId), next: sorted[0], upcoming: sorted.length }
    }).filter((row) => row.next)
      .sort((a, b) => (a.next.session_date).localeCompare(b.next.session_date))
  }, [sessions, classes])

  return <section className="page-stack">
    <PageTitle title="کلاس‌ها و جلسات" text={user.role === 'MEMBER' ? 'کلاس مناسب امروزت را انتخاب و رزرو کن.' : admin ? 'کلاس و جلسه جدید بساز و به مربی اختصاص بده.' : 'نمایی از برنامه‌ی کلاس‌های باشگاه.'} />
    <Message text={message} />
    {admin && <ClassSessionManager classes={classes} trainers={trainers} onChanged={load} setMessage={setMessage} />}
    <div className="session-grid">
      {byClass.map(({ gymClass, next, upcoming }) => {
        const booking = bookings.find((item) => item.session === next.id && item.status === 'CONFIRMED')
        const attended = attendance.some((item) => item.session === next.id)
        const cover = gymClass?.cover_image
        return <article className="session-card session-card-clickable" key={next.gym_class} onClick={() => setOpenId(next.id)}>
          {cover && <div className="session-cover"><img src={cover} alt={next.gym_class_name} /></div>}
          <div className="session-top">
            <span className="session-icon"><Dumbbell size={21} /></span>
            {upcoming > 1 && <span className="capacity">{toPersianDigits(upcoming)} جلسه پیش رو</span>}
          </div>
          <h3>{next.gym_class_name}</h3>
          <p>{gymClass?.category || next.trainer_name}</p>
          <div className="session-next">
            <strong>{formatDate(next.session_date)}</strong>
            <small>{next.trainer_name} · {toPersianDigits(next.start_time?.slice(0, 5))} تا {toPersianDigits(next.end_time?.slice(0, 5))}</small>
          </div>
          <div className="session-meta">
            <span>{toPersianDigits(next.remaining_capacity)} جای خالی</span>
            <Link className="text-button" to={`/classes/${next.gym_class}`} onClick={(e) => e.stopPropagation()}>صفحه کلاس</Link>
          </div>
          {/* A member joins a CLASS and is expected at its sessions, so the
              card opens the class's full schedule rather than silently
              booking whichever session happens to be next. */}
          {user.role === 'MEMBER' && (
            <div className="session-actions" onClick={(e) => e.stopPropagation()}>
              <Link className="button primary" to={`/classes/${next.gym_class}`}>
                <CalendarDays size={16} /> جلسات و رزرو
              </Link>
            </div>
          )}
        </article>
      })}
    </div>
    {!byClass.length && <Empty text="جلسه‌ای برای نمایش نیست." />}
    <AnimatePresence>
      {openSession && <SessionDetailModal session={openSession} gymClass={openClass} user={user} onClose={() => setOpenId(null)} setMessage={setMessage} />}
    </AnimatePresence>
  </section>
}

/** A class's own page: what it is, how it's gone historically, and when it
 *  runs next. Replaces the old popup — a class is a thing you research
 *  before committing to, not a tooltip. */
function ClassDetailPage({ user }) {
  const { id } = useParams()
  const admin = user.role === 'ADMIN'
  const [gymClass, setGymClass] = useState(null)
  const [history, setHistory] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [bookings, setBookings] = useState([])
  const [trainers, setTrainers] = useState([])

  // The trainers who actually teach this class, drawn from its sessions —
  // there's no direct class→trainer link in the model, so it's derived.
  const classTrainers = useMemo(() => {
    const ids = new Set()
    ;[...upcoming, ...(history?.sessions || [])].forEach((s) => s.trainer_id && ids.add(s.trainer_id))
    upcoming.forEach((s) => s.trainer && ids.add(s.trainer))
    return trainers.filter((t) => ids.has(t.id))
  }, [upcoming, history, trainers])

  const book = async (sessionId) => {
    try { await api.post('/bookings/', { session: sessionId }); setMessage('رزرو ثبت شد.'); load() }
    catch (e) { setMessage(errorMessage(e)) }
  }
  const cancelBooking = async (bookingId) => {
    try { await api.post(`/bookings/${bookingId}/cancel/`); setMessage('رزرو لغو شد.'); load() }
    catch (e) { setMessage(errorMessage(e)) }
  }

  const load = () => {
    api.get(`/classes/${id}/`).then(({ data }) => { setGymClass(data); setDraft(data.description_html || '') })
      .catch((e) => setMessage(errorMessage(e)))
    api.get(`/classes/${id}/history/`).then(({ data }) => setHistory(data)).catch(() => {})
    api.get(`/sessions/?gym_class=${id}&from=${todayIso()}&page_size=100`)
      .then(({ data }) => setUpcoming(getItems(data))).catch(() => {})
    if (user.role === 'MEMBER') api.get('/bookings/').then(({ data }) => setBookings(getItems(data))).catch(() => {})
    api.get('/auth/trainers/all/').then(({ data }) => setTrainers(getItems(data))).catch(() => {})
  }
  useEffect(() => { load() }, [id])

  const saveDescription = async () => {
    try {
      await api.patch(`/classes/${id}/`, { description_html: draft })
      setMessage('توضیحات کلاس ذخیره شد.'); setEditing(false); load()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  if (!gymClass) return <section className="page-stack"><Message text={message} />{!message && <Empty text="در حال بارگذاری..." />}</section>

  const s = history?.summary
  return <section className="page-stack">
    <Link to="/classes" className="blog-back-link"><ArrowLeft size={15} /> بازگشت به کلاس‌ها</Link>
    <Message text={message} />

    <header className="class-hero" style={gymClass.cover_image ? { backgroundImage: `url(${gymClass.cover_image})` } : undefined}>
      <div className="class-hero-body">
        {gymClass.category && <span className="event-hero-badge">{gymClass.category}</span>}
        <h2>{gymClass.name}</h2>
        {gymClass.description && <p>{gymClass.description}</p>}
      </div>
    </header>

    {!!s && s.sessions_held > 0 && (
      <div className="rate-grid">
        <div className="rate-card"><div className="rate-top"><span>جلسه برگزار شده</span><strong>{toPersianDigits(s.sessions_held)}</strong></div><small>تجربه‌ی این کلاس تا امروز</small></div>
        <div className="rate-card"><div className="rate-top"><span>میانگین حاضران</span><strong>{toPersianDigits(s.avg_attendance)}</strong></div><small>به‌طور متوسط در هر جلسه</small></div>
        <div className="rate-card"><div className="rate-top"><span>نرخ حضور</span><strong className={s.show_up_rate >= 70 ? 'good' : 'bad'}>{toPersianDigits(s.show_up_rate)}٪</strong></div>
          <div className="rate-bar"><motion.div className={s.show_up_rate >= 70 ? 'good' : 'bad'} initial={{ width: 0 }} animate={{ width: `${s.show_up_rate}%` }} transition={{ duration: .7 }} /></div>
          <small>از رزروکننده‌ها چند نفر واقعاً آمدند</small></div>
      </div>
    )}

    <Card title="درباره این کلاس" actionButton={admin && !editing && <button className="button muted" onClick={() => setEditing(true)}><Edit2 size={15} /> ویرایش</button>}>
      {editing ? <>
        <RichTextField label="" value={draft} onChange={setDraft} />
        <div className="inline-form" style={{ marginTop: '.7rem' }}>
          <button className="button primary" onClick={saveDescription}><Check size={16} /> ذخیره</button>
          <button className="button muted" onClick={() => { setEditing(false); setDraft(gymClass.description_html || '') }}>انصراف</button>
        </div>
      </> : <RichContent html={gymClass.description_html} fallback="توضیح کاملی برای این کلاس ثبت نشده." />}
    </Card>

    <div className="content-grid">
      <Card title="جلسات پیش رو">
        {upcoming.length ? upcoming.map((session) => {
          const mine = bookings.find((b) => b.session === session.id && b.status === 'CONFIRMED')
          return <div className="list-row" key={session.id}>
            <span className="session-icon"><CalendarDays size={16} /></span>
            <div><strong>{formatDate(session.session_date)}</strong><small>{session.trainer_name} · {toPersianDigits(session.start_time?.slice(0, 5))} تا {toPersianDigits(session.end_time?.slice(0, 5))}</small></div>
            <span className="capacity">{toPersianDigits(session.remaining_capacity)} جای خالی</span>
            {user.role === 'MEMBER' && (mine
              ? <button className="button muted session-book-btn" onClick={() => cancelBooking(mine.id)}>لغو رزرو</button>
              : <button className="button primary session-book-btn" disabled={session.is_full} onClick={() => book(session.id)}>{session.is_full ? 'تکمیل' : 'رزرو'}</button>)}
          </div>
        }) : <Empty text="جلسه‌ای برای این کلاس برنامه‌ریزی نشده." />}
      </Card>
      <Card title="مربیان این کلاس">
        {classTrainers.length ? classTrainers.map((t) => (
          <Link className="list-row class-link-row" key={t.id} to={`/trainers/${t.id}`}>
            {t.photo
              ? <img className="trainer-row-photo" src={t.photo} alt={t.full_name} />
              : <span className="avatar">{t.full_name?.[0]}</span>}
            <div><strong>{t.full_name}</strong><small>{t.specialization || 'مربی باشگاه'}</small></div>
            <ChevronLeft size={16} />
          </Link>
        )) : <Empty text="مربی‌ای برای این کلاس ثبت نشده." />}
      </Card>
      <Card title="تجربه جلسات قبلی">
        {history?.sessions?.length ? history.sessions.map((h) => (
          <div className="list-row" key={h.id}>
            <div><strong>{formatDate(h.session_date)}</strong>
              <small><Link className="trainer-link" to={`/trainers/${h.trainer_id}`}>{h.trainer_name}</Link></small></div>
            <span className="capacity">{toPersianDigits(h.attended)} از {toPersianDigits(h.booked)} رزرو</span>
          </div>
        )) : <Empty text="هنوز جلسه‌ای از این کلاس برگزار نشده." />}
      </Card>
    </div>
  </section>
}

function SessionDetailModal({ session, gymClass, user, onClose, setMessage }) {
  const canSeeRoster = user.role === 'ADMIN' || user.role === 'TRAINER'
  const [roster, setRoster] = useState(null)
  const [attendanceIds, setAttendanceIds] = useState(new Set())

  useEffect(() => {
    if (!canSeeRoster) return
    Promise.all([
      api.get(`/bookings/?session=${session.id}&status=CONFIRMED`),
      api.get(`/attendance/?session=${session.id}`),
    ]).then(([b, a]) => {
      setRoster(getItems(b.data))
      setAttendanceIds(new Set(getItems(a.data).map((item) => item.member)))
    }).catch((e) => setMessage?.(errorMessage(e)))
  }, [session.id])

  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <div className="session-detail-header">
        <span className="session-icon"><Dumbbell size={21} /></span>
        <div>
          <h2>{session.gym_class_name}</h2>
          {gymClass?.category && <span className="competition-card-tag">{gymClass.category}</span>}
        </div>
      </div>
      <div className="event-detail-meta">
        <span><CalendarDays size={14} /> {formatDate(session.session_date)}</span>
        <span><Users size={14} /> {session.trainer_name}</span>
      </div>
      <div className="session-meta">
        <span>{session.start_time?.slice(0, 5)} تا {session.end_time?.slice(0, 5)}</span>
        <span className="capacity">{session.booked_count} از {session.capacity} نفر</span>
      </div>
      <p className="event-detail-desc">{gymClass?.description || 'توضیحاتی برای این کلاس ثبت نشده.'}</p>
      {session.gym_class && <Link className="button muted" to={`/classes/${session.gym_class}`}><ArrowLeft size={15} /> صفحه کامل این کلاس</Link>}
      {canSeeRoster && (
        <div className="session-roster">
          <h4>لیست شرکت‌کنندگان</h4>
          {roster === null ? <p className="empty">در حال بارگذاری...</p> : roster.length ? (
            <div className="roster-list">
              {roster.map((b) => (
                <div className="list-row" key={b.id}>
                  <span className="icon-chip blue"><CircleUserRound size={16} /></span>
                  <div><strong>{b.member_name}</strong></div>
                  {attendanceIds.has(b.member) && <span className="attended-badge roster-attended"><Check size={13} /> حاضر</span>}
                </div>
              ))}
            </div>
          ) : <Empty text="هنوز کسی رزرو نکرده است." />}
        </div>
      )}
    </motion.div>
  </motion.div>
}

function TrainersPage() {
  const [trainers, setTrainers] = useState([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    api.get('/auth/trainers/all/').then(({ data }) => setTrainers(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  }, [])
  return <section className="page-stack">
    <PageTitle title="مربیان باشگاه" text="با مربی‌ها آشنا شو و برنامه‌ی کلاس‌هایشان را ببین." />
    <Message text={message} />
    <div className="trainer-grid">
      {trainers.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .05 }}>
          <Link to={`/trainers/${t.id}`} className="trainer-card">
            {t.photo
              ? <img className="trainer-card-photo" src={t.photo} alt={t.full_name} />
              : <span className="avatar trainer-card-avatar">{t.full_name?.[0]}</span>}
            <strong>{t.full_name}</strong>
            <small>{t.specialization || 'مربی باشگاه'}</small>
          </Link>
        </motion.div>
      ))}
    </div>
    {!trainers.length && <Empty text="مربی‌ای ثبت نشده است." />}
  </section>
}

/** A trainer's public page. Student figures are counts only — who trains
 *  with whom is other members' private business. */
function TrainerProfilePage({ user }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // A trainer may edit their own page; so may an admin.
  const canEdit = user.role === 'ADMIN' || (user.role === 'TRAINER' && data?.full_name === user.full_name)

  const load = () => api.get(`/auth/trainers/${id}/profile/`)
    .then(({ data }) => { setData(data); setDraft(data.bio_html || '') })
    .catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [id])

  const saveBio = async () => {
    try {
      await api.patch('/auth/me/', { bio_html: draft })
      setMessage('بیو ذخیره شد.'); setEditing(false); load()
    } catch (e) { setMessage(errorMessage(e)) }
  }

  if (!data) return <section className="page-stack"><Message text={message} />{!message && <Empty text="در حال بارگذاری..." />}</section>

  const st = data.stats
  return <section className="page-stack">
    <Link to="/trainers" className="blog-back-link"><ArrowLeft size={15} /> بازگشت به مربیان</Link>
    <Message text={message} />

    <header className="profile-hero">
      {data.photo
        ? <img className="profile-hero-photo" src={data.photo} alt={data.full_name} />
        : <span className="avatar profile-hero-avatar">{data.full_name?.[0]}</span>}
      <div>
        <h2>{data.full_name}</h2>
        <p>{data.specialization || 'مربی باشگاه'}{data.experience_years ? ` · ${toPersianDigits(data.experience_years)} سال سابقه` : ''}</p>
        {data.bio && <p className="profile-hero-bio">{data.bio}</p>}
      </div>
    </header>

    {/* Three facts, not eight. Session counts and raw check-in totals said
        nothing a member deciding on a trainer would act on. */}
    <div className="rate-grid trainer-facts">
      <div className="rate-card"><div className="rate-top"><span>شاگرد</span><strong>{toPersianDigits(st.students_taught)}</strong></div><small>تعداد افرادی که با او تمرین کرده‌اند</small></div>
      <div className="rate-card"><div className="rate-top"><span>حوزه کاری</span><strong className="rate-text">{data.specialization || 'تمرینات عمومی'}</strong></div></div>
      <div className="rate-card"><div className="rate-top"><span>سابقه</span><strong>{toPersianDigits(data.experience_years)} سال</strong></div></div>
    </div>

    <Card title="درباره مربی" actionButton={canEdit && !editing && <button className="button muted" onClick={() => setEditing(true)}><Edit2 size={15} /> ویرایش</button>}>
      {editing ? <>
        <RichTextField label="" value={draft} onChange={setDraft} />
        <div className="inline-form" style={{ marginTop: '.7rem' }}>
          <button className="button primary" onClick={saveBio}><Check size={16} /> ذخیره</button>
          <button className="button muted" onClick={() => { setEditing(false); setDraft(data.bio_html || '') }}>انصراف</button>
        </div>
      </> : <RichContent html={data.bio_html} fallback="این مربی هنوز معرفی کاملی ننوشته." />}
    </Card>

    <div className="content-grid">
      <Card title="کلاس‌هایی که تدریس می‌کند">
        {data.classes.length ? data.classes.map((c) => (
          <Link className="list-row class-link-row" key={c.id} to={`/classes/${c.id}`}>
            <span className="session-icon"><Dumbbell size={16} /></span>
            <div><strong>{c.name}</strong><small>{c.category}</small></div>
            <ChevronLeft size={16} />
          </Link>
        )) : <Empty text="کلاسی ثبت نشده." />}
      </Card>
      <Card title="جلسات پیش رو">
        {data.upcoming_sessions.length ? data.upcoming_sessions.map((s) => (
          <div className="list-row" key={s.id}>
            <div><strong>{s.gym_class}</strong><small>{formatDate(s.session_date)} · {toPersianDigits(s.start_time?.slice(0, 5))}</small></div>
            <span className="capacity">{toPersianDigits(s.booked)} از {toPersianDigits(s.capacity)}</span>
          </div>
        )) : <Empty text="جلسه‌ای برنامه‌ریزی نشده." />}
      </Card>
    </div>
  </section>
}

/** A member's public page. `can_see_detail` comes from the server, which is
 *  where the privacy decision is actually enforced — this only renders what
 *  it was given. */
function MemberProfilePage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    api.get(`/auth/members/${id}/profile/`).then(({ data }) => setData(data)).catch((e) => setMessage(errorMessage(e)))
  }, [id])
  if (!data) return <section className="page-stack"><Message text={message} />{!message && <Empty text="در حال بارگذاری..." />}</section>

  return <section className="page-stack">
    <Link to="/leaderboard" className="blog-back-link"><ArrowLeft size={15} /> بازگشت</Link>
    <Message text={message} />
    <header className="profile-hero">
      <span className="avatar profile-hero-avatar">{data.full_name?.[0]}</span>
      <div>
        <h2>{data.full_name} {data.is_me && <span className="capacity">خودت</span>}</h2>
        <p><span className="points-tier-emoji small">{data.tier_emoji}</span> سطح {data.tier} · عضو از {formatDate(data.member_since)}</p>
      </div>
    </header>

    {data.can_see_detail ? <>
      <div className="rate-grid">
        <div className="rate-card"><div className="rate-top"><span>امتیاز</span><strong>{toPersianDigits(data.points)}</strong></div></div>
        <div className="rate-card"><div className="rate-top"><span>کل حضورها</span><strong>{toPersianDigits(data.stats.total_check_ins)}</strong></div></div>
        <div className="rate-card"><div className="rate-top"><span>۳۰ روز اخیر</span><strong>{toPersianDigits(data.stats.check_ins_30d)}</strong></div></div>
        <div className="rate-card"><div className="rate-top"><span>کلاس تجربه‌شده</span><strong>{toPersianDigits(data.stats.classes_tried)}</strong></div></div>
      </div>
      <Card title="کلاس‌های اخیر">
        {data.recent_classes.length ? data.recent_classes.map((c, i) => (
          <div className="list-row" key={i}>
            <span className="icon-chip blue"><Dumbbell size={16} /></span>
            <div><strong>{c.gym_class}</strong><small>{c.trainer_name}</small></div>
            <span className="capacity">{formatDate(c.date)}</span>
          </div>
        )) : <Empty text="هنوز در کلاسی شرکت نکرده." />}
      </Card>
    </> : (
      <Card title="پروفایل خصوصی">
        <div className="private-profile"><UserX size={30} />
          <p>این عضو پروفایلش را خصوصی کرده است. فعالیت و کلاس‌هایش نمایش داده نمی‌شود.</p>
        </div>
      </Card>
    )}
  </section>
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
            {/* can_edit is computed server-side: an admin may edit anything
                their gym owns, a trainer only what they added. The shared
                library is read-only for everyone. */}
            {ex.can_edit && <>
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
                <span className="competition-card-days">{toPersianDigits(c.days_remaining)} روز مانده</span>
                <h4 className="competition-card-title">{c.title}</h4>
              </div>
              <div className="competition-card-body">
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
      <JalaliDateField label="تاریخ شروع" value={form.start_date} onChange={(start_date) => setForm({ ...form, start_date })} required />
      <JalaliDateField label="تاریخ پایان" value={form.end_date} onChange={(end_date) => setForm({ ...form, end_date })} required />
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
      <JalaliDateField label="تاریخ رویداد" value={form.event_date} onChange={(event_date) => setForm({ ...form, event_date })} required />
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
                <span className="competition-card-days">{e.days_remaining >= 0 ? `${toPersianDigits(e.days_remaining)} روز مانده` : 'برگزار شد'}</span>
                <h4 className="competition-card-title">{e.title}</h4>
              </div>
              <div className="competition-card-body">
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

const BLOG_CATEGORIES = [
  { value: 'COMPETITION_REPORT', label: 'گزارش مسابقه' },
  { value: 'NEWS', label: 'اخبار باشگاه' },
  { value: 'GENERAL', label: 'عمومی' },
]
const blogCategoryLabel = (value) => BLOG_CATEGORIES.find((c) => c.value === value)?.label || value

function BlogManager({ onCreated, setMessage }) {
  const blank = () => ({ title: '', category: 'GENERAL', content_html: '', video_url: '', is_published: true })
  const [form, setForm] = useState(blank())
  const [imageFile, setImageFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data: created } = await api.post('/blog/', form)
      if (imageFile) {
        const fd = new FormData()
        fd.append('cover_image', imageFile)
        await api.patch(`/blog/${created.slug}/`, fd)
      }
      setMessage('مطلب جدید ثبت شد.')
      setForm(blank())
      setImageFile(null)
      onCreated()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }

  return <Card title="نوشتن مطلب جدید">
    <form onSubmit={submit} className="form-grid compact">
      <Field label="عنوان" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <label>دسته‌بندی
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {BLOG_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <RichTextField label="متن مطلب (می‌توانی بین متن عکس اضافه کنی)" value={form.content_html} onChange={(content_html) => setForm({ ...form, content_html })} />
      <Field label="لینک ویدئو (اختیاری)" value={form.video_url} onChange={(video_url) => setForm({ ...form, video_url })} />
      <label>عکس کاور (اختیاری)
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </label>
      <label className="blog-publish-check">
        <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
        <span>همین الان منتشر شود <small>(در غیر این صورت به‌عنوان پیش‌نویس ذخیره می‌شود)</small></span>
      </label>
      <button className="button primary" disabled={busy}><Plus size={16} /> ثبت مطلب</button>
    </form>
  </Card>
}

function BlogPage({ user }) {
  const canManage = user.role === 'ADMIN' || user.role === 'TRAINER'
  const [posts, setPosts] = useState([])
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const load = () => api.get('/blog/').then(({ data }) => setPosts(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])

  return <section className="page-stack">
    <PageTitle title="وبلاگ باشگاه" text="گزارش مسابقه‌ها، اخبار و مطالب آموزشی باشگاه." />
    <Message text={message} />
    {canManage && <BlogManager onCreated={load} setMessage={setMessage} />}
    <Card title="مطالب">
      {posts.length ? (
        <div className="blog-grid">
          {posts.map((post, i) => (
            <motion.article className="blog-card" key={post.id} onClick={() => navigate(`/blog/${post.slug}`)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: i * .05 }}>
              <div className="blog-card-image">
                {post.cover_image ? <img src={post.cover_image} alt={post.title} /> : <Newspaper size={26} />}
                {!post.is_published && <span className="blog-card-draft">پیش‌نویس</span>}
              </div>
              <div className="blog-card-body">
                <span className="competition-card-tag">{blogCategoryLabel(post.category)}</span>
                <h4>{post.title}</h4>
                <p>{post.content.length > 90 ? `${post.content.slice(0, 90)}…` : post.content}</p>
                <div className="competition-card-footer">
                  <span>{post.author_name || 'باشگاه'}</span>
                  <span>{formatDate(post.created_at)}</span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      ) : <Empty text="هنوز مطلبی منتشر نشده است." />}
    </Card>
  </section>
}

function BlogPostDetail({ user }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const canManage = user?.role === 'ADMIN' || user?.role === 'TRAINER'
  const [post, setPost] = useState(null)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = () => api.get(`/blog/${slug}/`)
    .then(({ data }) => { setPost(data); setDraft({ title: data.title, category: data.category, content_html: data.content_html || '', video_url: data.video_url || '', is_published: data.is_published }) })
    .catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { setPost(null); setEditing(false); setConfirmDelete(false); load() }, [slug])

  const save = async () => {
    try {
      const { data } = await api.patch(`/blog/${slug}/`, draft)
      setMessage('مطلب به‌روزرسانی شد.')
      setEditing(false)
      // The slug is regenerated from the title, so editing the title moves
      // the post to a new URL — follow it instead of 404ing on the old one.
      if (data.slug && data.slug !== slug) navigate(`/blog/${data.slug}`, { replace: true })
      else load()
    } catch (e) { setMessage(errorMessage(e)) }
  }
  const remove = async () => {
    try { await api.delete(`/blog/${slug}/`); navigate('/blog', { replace: true }) }
    catch (e) { setMessage(errorMessage(e)) }
  }

  if (!post) return <section className="page-stack"><Message text={message} />{!message && <Empty text="در حال بارگذاری..." />}</section>
  const embedUrl = youtubeEmbedUrl(post.video_url)

  return <section className="page-stack blog-detail">
    <div className="calendar-page-head">
      <Link to="/blog" className="blog-back-link"><ArrowLeft size={15} /> بازگشت به وبلاگ</Link>
      {canManage && !editing && (
        <div className="inline-form">
          <button className="button muted" onClick={() => setEditing(true)}><Edit2 size={15} /> ویرایش</button>
          <button className="button muted" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> حذف</button>
        </div>
      )}
    </div>
    <Message text={message} />

    {confirmDelete && (
      <div className="confirm-bar">
        <span>این مطلب برای همیشه حذف شود؟</span>
        <button className="button muted" onClick={() => setConfirmDelete(false)}>انصراف</button>
        <button className="button danger" onClick={remove}><Trash2 size={15} /> بله، حذف کن</button>
      </div>
    )}

    <Card>
      {editing ? (
        <div className="form-grid compact">
          <Field label="عنوان" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <label>دسته‌بندی
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {BLOG_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <RichTextField label="متن مطلب" value={draft.content_html} onChange={(content_html) => setDraft({ ...draft, content_html })} />
          <Field label="لینک ویدئو (اختیاری)" value={draft.video_url} onChange={(video_url) => setDraft({ ...draft, video_url })} />
          <label className="blog-publish-check">
            <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
            <span>منتشر شده باشد</span>
          </label>
          <div className="inline-form">
            <button className="button primary" onClick={save}><Check size={16} /> ذخیره تغییرات</button>
            <button className="button muted" onClick={() => { setEditing(false); load() }}>انصراف</button>
          </div>
        </div>
      ) : <>
        {post.cover_image && <div className="blog-detail-cover"><img src={post.cover_image} alt={post.title} /></div>}
        <div className="blog-detail-meta">
          <span className="competition-card-tag">{blogCategoryLabel(post.category)}</span>
          <span>{post.author_name || 'باشگاه'}</span>
          <span>{formatDate(post.created_at)}</span>
          {!post.is_published && <span className="blog-card-draft-inline">پیش‌نویس</span>}
        </div>
        <h2 className="blog-detail-title">{post.title}</h2>
        <div className="blog-detail-content">
          {post.content_html
            ? <RichContent html={post.content_html} />
            : post.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {post.video_url && (embedUrl
          ? <div className="video-embed-frame"><iframe src={embedUrl} title={post.title} allowFullScreen /></div>
          : <a className="button primary" href={post.video_url} target="_blank" rel="noreferrer"><Video size={16} /> مشاهده ویدئو</a>)}
      </>}
    </Card>
  </section>
}

/** Trainer's view of /calendar: the plan-building workspace. Members get
 * `MyCalendarPage` instead — same route, completely different job. */
function TrainerPlans({ user }) {
  const [workouts, setWorkouts] = useState([]); const [diets, setDiets] = useState([]); const [assignments, setAssignments] = useState([]); const [message, setMessage] = useState('')
  const load = () => Promise.all([api.get('/workout-plans/'), api.get('/diet-plans/'), api.get('/auth/assignments/')]).then(([a, b, c]) => { setWorkouts(getItems(a.data)); setDiets(getItems(b.data)); setAssignments(getItems(c.data)) }).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [user.role])
  const archive = async (type, id) => { try { await api.post(`/${type}/${id}/archive/`); setMessage('برنامه بایگانی شد.'); load() } catch (e) { setMessage(errorMessage(e)) } }
  const [editingDiet, setEditingDiet] = useState(null)
  const savedDiet = (text) => { setMessage(text); setEditingDiet(null); load() }
  return <section className="page-stack"><PageTitle title="برنامه‌سازی اعضا" text="برنامه‌های تمرین و رژیم اعضای تحت مربی‌گری‌ات." /><Message text={message} />
    <WorkoutPlanBuilder assignments={assignments} onCreated={load} onError={setMessage} />
    <DietPlanBuilder
      key={editingDiet?.id || 'new'}
      assignments={assignments}
      editingPlan={editingDiet}
      onSaved={savedDiet}
      onCancelEdit={() => setEditingDiet(null)}
      onError={setMessage}
    />
    <div className="content-grid"><PlanSection title="برنامه تمرینی" kind="workout-plans" plans={workouts} canEdit archive={archive} onChanged={load} setMessage={setMessage} /><PlanSection title="رژیم غذایی" kind="diet-plans" plans={diets} canEdit archive={archive} onChanged={load} setMessage={setMessage} onEditPlan={setEditingDiet} /></div>
  </section>
}

/* Chip vocabulary for the calendar. Each kind owns one colour from the
   zurkhaneh palette so a glance at the month tells you what sort of day it
   is without reading a word. */
const AGENDA_KINDS = {
  workout: { label: 'تمرین', icon: Dumbbell, tone: 'glaze' },
  class: { label: 'کلاس', icon: CalendarDays, tone: 'plum' },
  event: { label: 'رویداد', icon: CalendarRange, tone: 'saffron' },
  meal: { label: 'وعده غذایی', icon: Salad, tone: 'olive' },
}

/** The member's whole life in one month grid: workout days from their plan,
 * classes they've booked, gym events, and (in the day panel only) the meals
 * their diet plan calls for.
 *
 * Meals deliberately get no chip in the grid: a diet plan covers a
 * continuous date range, so every single cell would carry one and the
 * marker would say nothing. They appear in the agenda for the selected day,
 * where they're actually actionable. */
/** The gym calendar.
 *
 *  Same surface for everyone, different scope and powers:
 *  a member sees their own plan, their bookings and gym-wide events and can
 *  start a session; a trainer sees the sessions they teach; an admin sees
 *  every session in the gym. Staff never get a start button — running a
 *  workout is the member's own record. */
function MyCalendarPage({ user }) {
  const navigate = useNavigate()
  const staff = user.role === 'ADMIN' || user.role === 'TRAINER'
  const [workouts, setWorkouts] = useState([])
  const [diets, setDiets] = useState([])
  const [bookings, setBookings] = useState([])
  const [events, setEvents] = useState([])
  const [competitions, setCompetitions] = useState([])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [popupDate, setPopupDate] = useState(null)

  useEffect(() => {
    // Staff read the schedule itself; members read what they signed up for.
    // /sessions/ is already role-scoped server-side: a trainer gets their
    // own sessions, an admin gets the whole gym.
    // A wide window with a large page: the calendar can be scrolled a few
    // months either way, and the default 20-row page returned whichever
    // sessions happened to sort first — for an admin, who also sees past
    // ones, that was the wrong month entirely.
    const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 150 * 864e5).toISOString().slice(0, 10)
    const sessionsUrl = `/sessions/?from=${from}&to=${to}&page_size=400`
    const calls = staff
      ? [api.get(sessionsUrl), api.get('/events/'), api.get('/competitions/')]
      : [api.get('/workout-plans/'), api.get('/diet-plans/'), api.get('/bookings/'), api.get('/events/'), api.get('/competitions/')]
    Promise.all(calls).then((res) => {
      if (staff) {
        setSessions(getItems(res[0].data)); setEvents(getItems(res[1].data)); setCompetitions(getItems(res[2].data))
      } else {
        setWorkouts(getItems(res[0].data)); setDiets(getItems(res[1].data))
        setBookings(getItems(res[2].data)); setEvents(getItems(res[3].data)); setCompetitions(getItems(res[4].data))
      }
    }).catch((err) => setMessage(errorMessage(err)))
  }, [])

  // date -> { workouts, classes, events }. Meals are resolved per-day below
  // because they're stored as a range on the plan, not as dated rows.
  const dayMap = useMemo(() => {
    const map = new Map()
    const push = (date, kind, payload) => {
      if (!date) return
      if (!map.has(date)) map.set(date, { workouts: [], classes: [], events: [] })
      map.get(date)[kind].push(payload)
    }
    workouts.filter((p) => !p.is_archived).forEach((plan) =>
      (plan.days || []).forEach((day) => push(day.date, 'workouts', { plan, day })))
    bookings.filter((b) => b.status === 'CONFIRMED').forEach((b) =>
      push(b.session_detail?.session_date, 'classes', b))
    // Staff see the schedule as scheduled, not as booked.
    sessions.forEach((s) => push(s.session_date, 'classes', {
      id: `s-${s.id}`,
      session_detail: {
        gym_class: s.gym_class_name, trainer: s.trainer_name,
        session_date: s.session_date, start_time: s.start_time, end_time: s.end_time,
      },
      capacity: s.capacity, booked: s.booked_count,
    }))
    events.forEach((e) => push(e.event_date, 'events', e))
    competitions.forEach((c) => push(c.start_date, 'events', { ...c, title: `مسابقه: ${c.title}`, location: '' }))
    return map
  }, [workouts, bookings, events, competitions, sessions])

  const mealsFor = (date) => diets
    .filter((d) => !d.is_archived && d.start_date <= date && date <= d.end_date)
    .flatMap((d) => (d.items || []).map((item) => ({ ...item, planTitle: d.title })))

  const selected = dayMap.get(selectedDate) || { workouts: [], classes: [], events: [] }
  const meals = mealsFor(selectedDate)

  return <section className="page-stack calendar-page">
    <div className="calendar-page-head">
      <PageTitle
        title={staff ? 'تقویم باشگاه' : 'تقویم من'}
        text={user.role === 'ADMIN' ? 'همه جلسات، رویدادها و مسابقات باشگاه در یک نما.'
          : staff ? 'جلسات تدریس تو، رویدادها و مسابقات باشگاه.'
          : 'تمرین‌ها، کلاس‌ها، رویدادها و وعده‌های غذایی هر روز، یکجا.'} />
      {!staff && <button className="button muted walk-cta" onClick={() => navigate('/walk')}><MapPin size={16} /> آغاز پیاده‌روی</button>}
    </div>
    <Message text={message} />
    <MonthCalendar dayMap={dayMap} selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpenDay={setPopupDate} />
    <DayAgenda date={selectedDate} data={selected} meals={meals} canStart={!staff}
      onStartWorkout={(planId, dayId) => navigate(`/workout/${planId}/${dayId}`)} />
    <AnimatePresence>
      {popupDate && (
        <motion.div className="modal-overlay" onClick={() => setPopupDate(null)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
          <motion.div className="modal-card modal-card-media" onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: .95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }}>
            <button className="icon-button modal-close" onClick={() => setPopupDate(null)}><X size={17} /></button>
            <DayAgenda
              date={popupDate}
              data={dayMap.get(popupDate) || { workouts: [], classes: [], events: [] }}
              meals={mealsFor(popupDate)}
              canStart={!staff}
              onStartWorkout={(planId, dayId) => { setPopupDate(null); navigate(`/workout/${planId}/${dayId}`) }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </section>
}

/** Full-width month grid. Same Jalali maths as the compact calendar inside
 * a plan modal, but each cell is a real surface that can carry chips. */
function MonthCalendar({ dayMap, selectedDate, onSelectDate, onOpenDay }) {
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
  const goToday = () => { setViewYear(todayJy); setViewMonth(todayJm); onSelectDate(todayKey) }

  const chipsFor = (entry) => {
    if (!entry) return []
    return [
      ...entry.workouts.map(({ day }) => ({ kind: 'workout', text: day.label || 'تمرین' })),
      ...entry.classes.map((b) => ({ kind: 'class', text: b.session_detail.gym_class, time: b.session_detail.start_time?.slice(0, 5) })),
      ...entry.events.map((e) => ({ kind: 'event', text: e.title })),
    ]
  }

  return <section className="month-calendar">
    <header className="month-calendar-head">
      <div className="month-calendar-nav">
        <button className="icon-button" onClick={nextMonth} aria-label="ماه بعد"><ChevronRight size={16} /></button>
        <strong>{monthLabel}</strong>
        <button className="icon-button" onClick={prevMonth} aria-label="ماه قبل"><ChevronLeft size={16} /></button>
      </div>
      <div className="month-calendar-legend">
        {Object.entries(AGENDA_KINDS).filter(([k]) => k !== 'meal').map(([key, cfg]) => (
          <span className="legend-item" key={key}><i className={`legend-dot tone-${cfg.tone}`} />{cfg.label}</span>
        ))}
        <button className="button muted month-today-btn" onClick={goToday}>امروز</button>
      </div>
    </header>
    <div className="month-grid">
      {WEEKDAY_LABELS_SAT_FIRST.map((w) => <span className="month-weekday" key={w}>{w}</span>)}
      {cells.map((cell, i) => {
        if (!cell) return <span className="month-cell empty" key={`empty-${i}`} />
        const chips = chipsFor(dayMap.get(cell.key))
        return (
          <button
            key={cell.key}
            className={`month-cell ${cell.key === selectedDate ? 'selected' : ''} ${cell.key === todayKey ? 'today' : ''} ${chips.length ? 'has-items' : ''}`}
            onClick={() => onSelectDate(cell.key)}
            // A cell can only show three chips; a second click (or a click on
            // an already-selected day) opens everything that didn't fit.
            onDoubleClick={() => chips.length && onOpenDay?.(cell.key)}
          >
            <span className="month-cell-date">{toPersianDigits(cell.jDay)}</span>
            <span className="month-cell-chips">
              {chips.slice(0, 3).map((chip, ci) => (
                <span className={`month-chip tone-${AGENDA_KINDS[chip.kind].tone}`} key={ci}>
                  {chip.time && <b>{toPersianDigits(chip.time)}</b>}{chip.text}
                </span>
              ))}
              {chips.length > 3 && (
                <span className="month-chip more" role="button"
                  onClick={(e) => { e.stopPropagation(); onOpenDay?.(cell.key) }}>
                  +{toPersianDigits(chips.length - 3)} مورد دیگر
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  </section>
}

/** Everything happening on the selected day, grouped by kind, with the
 * actions that belong to each (start the workout, see the class). */
function DayAgenda({ date, data, meals, onStartWorkout, canStart = true }) {
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0)
  const isEmpty = !data.workouts.length && !data.classes.length && !data.events.length && !meals.length

  return <section className="day-agenda">
    <header className="day-agenda-head">
      <div>
        <p className="eyebrow">برنامه روز</p>
        <h3>{formatDate(date)}</h3>
      </div>
      {!!meals.length && <span className="capacity"><Flame size={13} /> {toPersianDigits(totalCalories)} کالری هدف</span>}
    </header>

    {isEmpty && <Empty text="برای این روز چیزی ثبت نشده است." />}

    {data.workouts.map(({ plan, day }) => (
      <article className="agenda-block tone-glaze" key={day.id}>
        <div className="agenda-block-head">
          <span className="agenda-icon"><Dumbbell size={18} /></span>
          <div>
            <strong>{day.label || 'تمرین امروز'}</strong>
            <small>{plan.title} · {toPersianDigits(day.items.length)} حرکت</small>
          </div>
          {!canStart
            ? <span className="capacity">فقط مشاهده</span>
            : day.date > todayIso()
              ? <span className="capacity agenda-future">از {formatDate(day.date)} فعال می‌شود</span>
              : <button className="button primary" onClick={() => onStartWorkout(plan.id, day.id)}><Play size={15} /> شروع تمرین</button>}
        </div>
        <div className="agenda-exercises">
          {day.items.map((item) => (
            <span className="agenda-exercise" key={item.id}>
              {item.exercise_name}<b>{toPersianDigits(item.sets)}×{toPersianDigits(item.reps)}</b>
            </span>
          ))}
        </div>
      </article>
    ))}

    {data.classes.map((b) => (
      <article className="agenda-block tone-plum" key={`c-${b.id}`}>
        <div className="agenda-block-head">
          <span className="agenda-icon"><CalendarDays size={18} /></span>
          <div>
            <strong>{b.session_detail.gym_class}</strong>
            <small>{b.session_detail.trainer} · {toPersianDigits(b.session_detail.start_time?.slice(0, 5))} تا {toPersianDigits(b.session_detail.end_time?.slice(0, 5))}
              {b.capacity != null && ` · ${toPersianDigits(b.booked)} از ${toPersianDigits(b.capacity)} نفر`}</small>
          </div>
          <Link className="button muted" to="/classes">جزئیات کلاس</Link>
        </div>
      </article>
    ))}

    {data.events.map((e) => (
      <article className="agenda-block tone-saffron" key={`e-${e.id}`}>
        <div className="agenda-block-head">
          <span className="agenda-icon"><CalendarRange size={18} /></span>
          <div>
            <strong>{e.title}</strong>
            <small>{e.location || 'باشگاه تناسب'}</small>
          </div>
          <Link className="button muted" to="/events">جزئیات رویداد</Link>
        </div>
      </article>
    ))}

    {!!meals.length && (
      <article className="agenda-block tone-olive">
        <div className="agenda-block-head">
          <span className="agenda-icon"><Salad size={18} /></span>
          <div>
            <strong>وعده‌های غذایی</strong>
            <small>{meals[0].planTitle} · {toPersianDigits(meals.length)} وعده</small>
          </div>
        </div>
        <div className="agenda-meals">
          {meals.map((m) => (
            <div className="agenda-meal" key={m.id}>
              <div><strong>{m.meal_name}</strong>{m.description && <small>{m.description}</small>}</div>
              <span className="capacity">{toPersianDigits(m.calories)} کالری</span>
            </div>
          ))}
        </div>
      </article>
    )}
  </section>
}

function PlanSection({ title, kind, plans, canEdit, archive, onChanged, setMessage, onEditPlan }) {
  const [openId, setOpenId] = useState(null)
  const openPlan = plans.find((plan) => plan.id === openId) || null
  const config = PLAN_KINDS[kind]
  return <>
    <Card title={title}>{plans.length ? plans.map((plan) => <PlanRow key={plan.id} plan={plan} config={config} onOpen={() => setOpenId(plan.id)} />) : <Empty text={`${title} موجود نیست.`} />}</Card>
    <AnimatePresence>
      {openPlan && <PlanModal plan={openPlan} kind={kind} config={config} canEdit={canEdit} onClose={() => setOpenId(null)} archive={archive} onChanged={onChanged} setMessage={setMessage} onEditPlan={onEditPlan} />}
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

/* CKEditor is bigger than the rest of the app combined and only
   admins/trainers can ever open it, so it is fetched on demand rather than
   shipped to every member. */
const RichTextEditor = lazy(() => import('./RichTextEditor'))

function RichTextField({ label, value, onChange }) {
  return <label className="rich-editor-field">{label}
    <Suspense fallback={<div className="rich-editor-loading">در حال بارگذاری ویرایشگر...</div>}>
      <RichTextEditor value={value} onChange={onChange} />
    </Suspense>
  </label>
}

/** Renders rich text written in the editor.
 *
 *  `dangerouslySetInnerHTML` is safe HERE and only here because every write
 *  path runs the HTML through bleach server-side (common/richtext.py) before
 *  it is ever stored — scripts, event handlers and javascript:/data: URLs
 *  are gone by the time this sees it. Never point this at text that hasn't
 *  been through that. */
function RichContent({ html, fallback }) {
  if (!html || !html.trim()) return fallback ? <p className="empty">{fallback}</p> : null
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />
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
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(days[0]?.date || null)
  const [detailItem, setDetailItem] = useState(null)
  const selectedDay = days.find((d) => d.date === selectedDate)

  return <>
    <WorkoutCalendar days={days} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
    {selectedDay ? (
      <div className="plan-modal-days">
        <div className="plan-day-group">
          <div className="plan-day-group-head">
            <h4>{selectedDay.label || formatDate(selectedDay.date)}</h4>
            <button className="button primary session-start-btn" onClick={() => navigate(`/workout/${planId}/${selectedDay.id}`)}><Play size={15} /> شروع تمرین</button>
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
    </AnimatePresence>
  </>
}

/** Guided "start workout" flow — one exercise at a time, tap each set to
 * check it off (which kicks off a 60s rest timer, skippable), then move to
 * the next exercise. Purely a live in-session guide (no history is
 * persisted) — the point is walking the member through *today's* session,
 * not building a training log. */
function WorkoutRunPage() {
  const { planId, dayId } = useParams()
  const navigate = useNavigate()
  const [day, setDay] = useState(null)
  const [error, setError] = useState('')

  // Re-fetched rather than handed through router state so the page survives
  // a refresh or a shared link.
  useEffect(() => {
    api.get('/workout-plans/').then(({ data }) => {
      const plan = getItems(data).find((p) => String(p.id) === String(planId))
      const found = plan?.days?.find((d) => String(d.id) === String(dayId))
      if (!found) { setError('این روز تمرینی پیدا نشد.'); return }
      setDay(found)
    }).catch((e) => setError(errorMessage(e)))
  }, [planId, dayId])

  if (error) return <section className="page-stack"><Link to="/calendar" className="blog-back-link"><ArrowLeft size={15} /> بازگشت به تقویم</Link><Message text={error} /></section>
  if (!day) return <section className="page-stack"><Empty text="در حال بارگذاری تمرین..." /></section>
  // Mirrors the server rule so the member gets an explanation instead of a
  // rejected save after they've already done the session.
  if (day.date > todayIso()) return <section className="page-stack">
    <Link to="/calendar" className="blog-back-link"><ArrowLeft size={15} /> بازگشت به تقویم</Link>
    <div className="run-complete">
      <CalendarDays size={48} className="session-complete-icon" />
      <h2>هنوز زود است</h2>
      <p>این تمرین برای <strong>{formatDate(day.date)}</strong> برنامه‌ریزی شده. از همان روز می‌توانی شروعش کنی.</p>
      <button className="button primary" onClick={() => navigate('/calendar')}>بازگشت به تقویم</button>
    </div>
  </section>
  return <WorkoutRunner day={day} planId={planId} onExit={() => navigate('/calendar')} />
}

/** Guided run of one workout day — one exercise at a time, tap each set to
 * check it off (which kicks off a 60s rest timer, skippable), then move on.
 * A live guide, not a training log: only the finished session's duration
 * and calories are persisted. */
function WorkoutRunner({ day, planId, onExit }) {
  const [index, setIndex] = useState(0)
  const [completedSets, setCompletedSets] = useState(() => day.items.map((it) => Array(it.sets).fill(false)))
  const [restSeconds, setRestSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [logged, setLogged] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
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
      activity_type: 'WORKOUT', workout_plan: planId, workout_day: day.id,
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
    return <section className="page-stack run-page">
      <motion.div className="run-complete" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
        <CheckCircle2 size={56} className="session-complete-icon" />
        <h2>تمرین امروز تموم شد! 💪</h2>
        <p>{toPersianDigits(day.items.length)} حرکت با موفقیت انجام شد. آفرین!</p>
        <div className="session-summary">
          <div><Timer size={16} /><strong>{formatDuration(elapsed)}</strong><small>مدت زمان</small></div>
          <div><Flame size={16} /><strong>{toPersianDigits(calories)}</strong><small>کالری سوزانده شد</small></div>
        </div>
        <button className="button primary" onClick={onExit}>بازگشت به تقویم</button>
      </motion.div>
    </section>
  }

  const doneCount = completedSets[index].filter(Boolean).length
  const allSetsDone = doneCount === item.sets

  return <section className="page-stack run-page">
    <div className="run-topbar">
      <button className="blog-back-link" onClick={onExit}><ArrowLeft size={15} /> پایان و خروج</button>
      <span className="run-timer"><Timer size={15} /> {formatDuration(elapsed)}</span>
    </div>

    <div className="run-progress">
      <div className="run-progress-bar"><motion.div animate={{ width: `${(index / day.items.length) * 100}%` }} transition={{ duration: .3 }} /></div>
      <small>حرکت {toPersianDigits(index + 1)} از {toPersianDigits(day.items.length)} · {day.label || 'تمرین امروز'}</small>
    </div>

    <div className="run-stage">
      <div className="run-main">
        <p className="eyebrow">{muscleGroupLabel(item.muscle_group)}</p>
        <h2 className="run-exercise-name">{item.exercise_name}</h2>
        <p className="run-target">هدف: {toPersianDigits(item.sets)} ست × {toPersianDigits(item.reps)} تکرار</p>
        {item.notes && <p className="session-notes">{item.notes}</p>}

        <p className="run-sets-label">روی هر ست بزن تا تیک بخورد</p>
        <div className="run-sets">
          {completedSets[index].map((done, i) => (
            <button key={i} className={`run-set ${done ? 'done' : ''}`} onClick={() => toggleSet(i)}>
              {done ? <CheckCircle2 size={22} /> : <span>{toPersianDigits(i + 1)}</span>}
              <small>ست {toPersianDigits(i + 1)}</small>
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
      </div>

      <aside className="run-side">
        <MuscleDiagram selected={item.muscle_group} size={120} />
        {item.video_url && <button className="button muted" onClick={() => setDetailItem(item)}><Video size={15} /> نمایش ویدئوی حرکت</button>}
        <div className="run-uplist">
          <p className="eyebrow">حرکت‌های این جلسه</p>
          {day.items.map((it, i) => (
            <button key={it.id} className={`run-uplist-row ${i === index ? 'current' : ''} ${i < index ? 'passed' : ''}`} onClick={() => { setRestSeconds(0); setIndex(i) }}>
              <span>{toPersianDigits(i + 1)}</span>
              <div><strong>{it.exercise_name}</strong><small>{toPersianDigits(it.sets)}×{toPersianDigits(it.reps)}</small></div>
              {i < index && <CheckCircle2 size={15} />}
            </button>
          ))}
        </div>
      </aside>
    </div>
    {allSetsDone && restSeconds === 0 && <p className="run-hint">همه ست‌های این حرکت انجام شد — برو حرکت بعدی 👇</p>}
    <AnimatePresence>
      {detailItem && <ExerciseItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </AnimatePresence>
  </section>
}

/** GPS-tracked walk/run — accumulates distance from consecutive
 * geolocation fixes (haversine, with a small jitter filter) while a live
 * timer and calorie estimate run alongside it. */
// Beyond this, a "position" is wifi/cell triangulation rather than GPS —
// useless for measuring a walk and actively harmful if counted.
const MAX_USABLE_ACCURACY_M = 40

/** Turns a raw accuracy reading into something a person can act on. */
function gpsSignal(accuracy, fixCount) {
  if (!fixCount) return { key: 'waiting', label: 'در حال گرفتن سیگنال ماهواره...', hint: 'چند لحظه صبر کن' }
  if (accuracy == null) return { key: 'waiting', label: 'در حال گرفتن سیگنال...', hint: '' }
  if (accuracy <= 10) return { key: 'good', label: `سیگنال خوب (±${Math.round(accuracy)} متر)`, hint: '' }
  if (accuracy <= MAX_USABLE_ACCURACY_M) return { key: 'fair', label: `سیگنال متوسط (±${Math.round(accuracy)} متر)`, hint: 'مسافت با خطا ثبت می‌شود' }
  return {
    key: 'weak',
    label: `سیگنال ضعیف (±${Math.round(accuracy)} متر)`,
    hint: 'داخل ساختمان GPS کار نمی‌کند — برای ثبت مسافت باید بیرون باشی',
  }
}

function WalkPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [distanceKm, setDistanceKm] = useState(0)
  const [error, setError] = useState('')
  const weightKg = useMemberWeight()
  const [accuracy, setAccuracy] = useState(null)
  const [fixCount, setFixCount] = useState(0)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const calories = estimateCalories('WALK', weightKg, elapsed)
  const signal = gpsSignal(accuracy, fixCount)

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
        setDistanceKm(0); setElapsed(0); setAccuracy(null); setFixCount(0); setActive(true)
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy: acc } = pos.coords
            setAccuracy(acc)
            setFixCount((n) => n + 1)

            // A fix this vague is wifi/cell triangulation, not GPS. Two such
            // readings can differ by tens of metres without anyone moving, so
            // counting them would invent distance out of noise.
            if (acc > MAX_USABLE_ACCURACY_M) return

            if (!lastPosRef.current) { lastPosRef.current = { lat: latitude, lon: longitude }; return }
            const km = haversineKm(lastPosRef.current.lat, lastPosRef.current.lon, latitude, longitude)
            // Deadband scaled to the fix's own uncertainty rather than a flat
            // 2m: a reading accurate to ±20m can't evidence a 3m step, so
            // requiring the movement to exceed the error is what separates
            // real walking from jitter.
            const thresholdKm = Math.max(0.003, (acc * 0.75) / 1000)
            if (km > thresholdKm) {
              setDistanceKm((prev) => prev + km)
              lastPosRef.current = { lat: latitude, lon: longitude }
            }
          },
          (e) => setError(e.code === 3
            ? 'سیگنال موقعیت‌یاب پیدا نشد. اگر داخل ساختمانی، برو فضای باز.'
            : 'دریافت موقعیت مکانی با خطا مواجه شد.'),
          // maximumAge:0 — the old value (5000) let the browser hand back the
          // SAME cached fix on consecutive callbacks, so the delta was zero
          // and the distance never moved. Live tracking needs fresh fixes.
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
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
    return <section className="page-stack run-page">
      <motion.div className="run-complete" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
        <CheckCircle2 size={56} className="session-complete-icon" />
        <h2>پیاده‌روی ثبت شد! 🚶</h2>
        <div className="session-summary">
          <div><Timer size={16} /><strong>{formatDuration(elapsed)}</strong><small>مدت زمان</small></div>
          <div><MapPin size={16} /><strong>{distanceKm.toFixed(2)}</strong><small>کیلومتر</small></div>
          <div><Flame size={16} /><strong>{toPersianDigits(calories)}</strong><small>کالری</small></div>
        </div>
        <button className="button primary" onClick={() => navigate('/calendar')}>بازگشت به تقویم</button>
      </motion.div>
    </section>
  }

  return <section className="page-stack run-page">
    {!active && <button className="blog-back-link" onClick={() => navigate('/calendar')}><ArrowLeft size={15} /> بازگشت به تقویم</button>}
    <motion.div className={`walk-stage ${active ? 'live' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <span className="walk-orb"><MapPin size={30} /></span>
      {active ? (
        <>
          <p className="eyebrow">در حال ضبط مسیر</p>
          <h2>در حال پیاده‌روی...</h2>
          <div className={`gps-signal gps-${signal.key}`}>
            <span className="gps-dot" />
            <div>
              <strong>{toPersianDigits(signal.label)}</strong>
              {signal.hint && <small>{signal.hint}</small>}
            </div>
          </div>
          <div className="session-summary walk-summary">
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
          <p>مسیر و مسافت پیاده‌روی‌ات با موقعیت مکانی گوشی ثبت می‌شود و کالری سوزانده‌شده به آمار امروزت اضافه می‌شود.</p>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" onClick={start}><Play size={16} /> شروع کن</button>
        </>
      )}
    </motion.div>
  </section>
}

function ExerciseItemDetailModal({ item, onClose }) {
  const embedUrl = youtubeEmbedUrl(item.video_url)
  return <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
    <motion.div className="modal-card modal-card-media" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <button className="icon-button modal-close" onClick={onClose}><X size={17} /></button>
      <h2>{item.exercise_name}</h2>
      <p className="plan-modal-meta">{item.sets}×{item.reps} تکرار{item.notes && ` · ${item.notes}`}</p>
      {item.video_url ? (
        embedUrl ? (
          <div className="video-embed-frame"><iframe src={embedUrl} title={item.exercise_name} allowFullScreen /></div>
        ) : (
          <a className="button primary" href={item.video_url} target="_blank" rel="noreferrer"><Video size={16} /> مشاهده ویدئوی آموزشی</a>
        )
      ) : <p className="empty">ویدئوی آموزشی برای این حرکت ثبت نشده.</p>}
      <MuscleDiagram selected={item.muscle_group} size={110} />
      <p className="muscle-diagram-caption">این حرکت روی «{muscleGroupLabel(item.muscle_group)}» فشار وارد می‌کند.</p>
    </motion.div>
  </motion.div>
}

function PlanModal({ plan, kind, config, canEdit, onClose, archive, onChanged, setMessage, onEditPlan }) {
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
      {canEdit && !plan.is_archived && <div className="inline-form">
        {onEditPlan && <button className="button muted" onClick={() => { onEditPlan(plan); onClose() }}><Edit2 size={16} /> ویرایش</button>}
        <button className="button muted" onClick={() => { archive(kind, plan.id); onClose() }}><Settings size={16} /> بایگانی این {config.label}</button>
      </div>}
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

  return <section className="page-stack"><PageTitle title="پیشرفت بدن" text="اعداد کوچک، تغییرهای بزرگ می‌سازند." /><Message text={message} /><div className="content-grid"><Card title="ثبت اندازه‌گیری"><form onSubmit={submit} className="form-grid compact"><JalaliDateField label="تاریخ" value={form.recorded_at} onChange={(recorded_at) => setForm({ ...form, recorded_at })} required /><Field label="وزن (کیلوگرم)" type="number" value={form.weight_kg} onChange={(weight_kg) => setForm({ ...form, weight_kg })} required /><Field label="چربی بدن (%)" type="number" value={form.body_fat_percent} onChange={(body_fat_percent) => setForm({ ...form, body_fat_percent })} /><Field label="دور کمر (سانتی‌متر)" type="number" value={form.waist_cm} onChange={(waist_cm) => setForm({ ...form, waist_cm })} /><button className="button primary">ثبت پیشرفت <Plus size={17} /></button></form></Card><Card title="روند پیشرفت" actionButton={<div className="factor-toggle">{PROGRESS_FACTORS.map((item) => <button key={item.key} className={item.key === factor ? 'chip active' : 'chip'} onClick={() => setFactor(item.key)}>{item.label}</button>)}</div>}>{entries.length ? <><div className="progress-chart"><ResponsiveContainer width="100%" height={220}><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--muted-2)" fontSize={11} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--ink)' }} formatter={(value) => [`${value} ${activeFactor.unit}`, activeFactor.label]} /><Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#progressFill)" connectNulls dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer></div><div className="progress-list">{entries.map((entry) => <div className="progress-row" key={entry.id}><div><strong>{formatDate(entry.recorded_at)}</strong><small>{entry.notes || 'یادداشتی ثبت نشده'}</small></div><div className="progress-values"><span>{entry.weight_kg} kg</span><span>{entry.body_fat_percent ?? '—'}%</span><span>{entry.waist_cm ?? '—'} cm</span></div></div>)}</div></> : <Empty text="اولین اندازه‌گیری را ثبت کن." />}</Card></div></section>
}

function Messages({ user }) {
  const [assignments, setAssignments] = useState([]); const [partner, setPartner] = useState(''); const [messages, setMessages] = useState([]); const [content, setContent] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { api.get('/auth/assignments/').then(({ data }) => { const items = getItems(data); setAssignments(items); if (items[0]) setPartner(String(user.role === 'MEMBER' ? items[0].trainer_user_id : items[0].member_user_id)) }).catch((e) => setMessage(errorMessage(e))) }, [user.role])
  useEffect(() => { if (partner) { api.get(`/messages/?with=${partner}`).then(({ data }) => setMessages(getItems(data))).catch((e) => setMessage(errorMessage(e))); api.post('/messages/mark-read/', { with: partner }).catch(() => {}) } }, [partner])
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const reload = async () => { const { data } = await api.get(`/messages/?with=${partner}`); setMessages(getItems(data)) }
  const send = async (event) => { event.preventDefault(); if (!content) return; try { await api.post('/messages/send/', { receiver: partner, content }); setContent(''); await reload() } catch (e) { setMessage(errorMessage(e)) } }
  const saveEdit = async (id) => {
    if (!editDraft.trim()) return
    try { await api.patch(`/messages/${id}/`, { content: editDraft }); setEditingId(null); await reload() }
    catch (e) { setMessage(errorMessage(e)) }
  }
  const removeMessage = async (id) => {
    try { await api.delete(`/messages/${id}/`); setConfirmId(null); await reload() }
    catch (e) { setMessage(errorMessage(e)) }
  }
  const label = (item) => user.role === 'MEMBER' ? item.trainer_name : item.member_name
  const partnerId = (item) => String(user.role === 'MEMBER' ? item.trainer_user_id : item.member_user_id)
  return <section className="page-stack"><PageTitle title="گفت‌وگو با مربی" text="سؤال‌ها، بازخوردها و همراهی روزانه." /><Message text={message} /><div className="chat-layout "><aside>{assignments.map((item) => <button className={partnerId(item) === partner ? 'chat-person active' : 'chat-person'} key={item.id} onClick={() => setPartner(partnerId(item))}><span className="avatar">{label(item)?.[0]}</span>{label(item)}</button>)}</aside><section className="chat-window">{partner ? <><div className="chat-messages">{messages.map((item) => {
      const mine = item.sender === user.id
      if (editingId === item.id) return <div className="bubble mine bubble-editing" key={item.id}>
        <input value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditingId(null) }} autoFocus />
        <div className="bubble-actions">
          <button className="text-button" onClick={() => saveEdit(item.id)}>ذخیره</button>
          <button className="text-button" onClick={() => setEditingId(null)}>انصراف</button>
        </div>
      </div>
      return <div className={mine ? 'bubble mine' : 'bubble'} key={item.id}>
        {item.content}
        <small>
          {new Date(item.sent_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
          {item.edited_at && <span className="bubble-edited"> · ویرایش شده</span>}
        </small>
        {/* Only your own words are yours to change. */}
        {mine && (confirmId === item.id
          ? <div className="bubble-actions"><span>حذف شود؟</span>
              <button className="text-button danger-text" onClick={() => removeMessage(item.id)}>بله</button>
              <button className="text-button" onClick={() => setConfirmId(null)}>خیر</button>
            </div>
          : <div className="bubble-actions">
              <button className="icon-button bubble-btn" title="ویرایش" onClick={() => { setEditingId(item.id); setEditDraft(item.content) }}><Edit2 size={12} /></button>
              <button className="icon-button bubble-btn" title="حذف" onClick={() => setConfirmId(item.id)}><Trash2 size={12} /></button>
            </div>)}
      </div>
    })}</div><form className="chat-form" onSubmit={send}><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="پیامت را بنویس..." /><button className="button primary"><MessageCircle size={18} /></button></form></> : <Empty text="مخاطبی برای گفت‌وگو پیدا نشد." />}</section></div></section>
}

function Notifications({ user }) {
  const admin = user.role === 'ADMIN'
  const [items, setItems] = useState([]); const [message, setMessage] = useState('')
  const load = () => api.get('/notifications/').then(({ data }) => setItems(getItems(data))).catch((e) => setMessage(errorMessage(e)))
  useEffect(() => { load() }, [])
  const read = async (id) => { await api.post(`/notifications/${id}/read/`); load() }
  return <section className="page-stack"><PageTitle title="اعلان‌ها" text="هر چیزی که لازم است بدانید، همین‌جاست." /><Message text={message} />
    {admin && <NotificationBroadcastPanel setMessage={setMessage} onSent={load} />}
    <Card title="همه اعلان‌ها" actionButton={<button className="text-button" onClick={() => api.post('/notifications/read-all/').then(load)}>خواندن همه</button>}>{items.map((item) => <button className={`notification-item ${item.is_read ? '' : 'unread'}`} onClick={() => read(item.id)} key={item.id}><span className="notice-dot" /><div><strong>{item.title}</strong><small>{item.message}</small></div><time>{formatDate(item.created_at)}</time></button>) || <Empty text="اعلانی وجود ندارد." />}</Card></section>
}

/** Admin-only: broadcast an announcement to the whole gym (in-app, plus a
 * real SMS if checked — the checkbox says plainly that it costs real
 * credit, since sms.ir bills per send), and a manual "send now" for
 * tomorrow's session reminders alongside the cron job that normally
 * handles it. */
function NotificationBroadcastPanel({ setMessage, onSent }) {
  const blank = () => ({ title: '', message: '', audience: 'ALL', send_sms: false })
  const [form, setForm] = useState(blank())
  const [busy, setBusy] = useState(false)
  const [remindBusy, setRemindBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/notifications/broadcast/', form)
      setMessage(form.send_sms
        ? `اطلاعیه به ${data.notified} نفر ارسال شد (${data.sms_sent} پیامک واقعی از ${data.sms_attempted} تلاش).`
        : `اطلاعیه به ${data.notified} نفر ارسال شد.`)
      setForm(blank())
      onSent()
    } catch (e) { setMessage(errorMessage(e)) } finally { setBusy(false) }
  }

  const sendReminders = async () => {
    setRemindBusy(true)
    try {
      const { data } = await api.post('/attendance/send-reminders/')
      setMessage(`یادآوری جلسات فردا (${formatDate(data.date)}) برای ${data.notified} نفر ارسال شد (${data.sms_sent} پیامک واقعی).`)
    } catch (e) { setMessage(errorMessage(e)) } finally { setRemindBusy(false) }
  }

  return <Card title="ارسال اطلاعیه به اعضا">
    <form onSubmit={submit} className="form-grid compact">
      <Field label="عنوان" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <label>متن پیام<textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></label>
      <label>مخاطب<select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
        <option value="ALL">همه اعضا و مربی‌ها</option>
        <option value="MEMBERS">فقط اعضا</option>
        <option value="TRAINERS">فقط مربی‌ها</option>
      </select></label>
      <label className="broadcast-sms-check">
        <input type="checkbox" checked={form.send_sms} onChange={(e) => setForm({ ...form, send_sms: e.target.checked })} />
        <span>ارسال پیامک واقعی هم بشود <small>(هزینه پیامک از حساب باشگاه کسر می‌شود)</small></span>
      </label>
      <button className="button primary" disabled={busy}><Send size={16} /> ارسال اطلاعیه</button>
    </form>
    <div className="broadcast-reminder-row">
      <div><strong>یادآوری جلسات فردا</strong><small>برای همه رزروهای تأییدشده‌ی فردا، همین حالا یادآوری بفرست (کار روزانه‌اش خودکار هم اجرا می‌شود).</small></div>
      <button className="button muted" onClick={sendReminders} disabled={remindBusy}><Bell size={15} /> ارسال الان</button>
    </div>
  </Card>
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
  const [overview, setOverview] = useState(null)
  useEffect(() => {
    Promise.all([api.get('/reports/subscriptions/'), api.get('/reports/revenue/'), api.get('/reports/attendance/'), api.get('/reports/popular/')]).then(([a, b, c, d]) => setReports({ subscriptions: a.data, revenue: b.data, attendance: getItems(c.data), popular: d.data })).catch((e) => setMessage(errorMessage(e)))
    api.get('/reports/trends/').then(({ data }) => setTrends(data)).catch(() => {})
    api.get('/reports/overview/').then(({ data }) => setOverview(data)).catch(() => {})
    loadUsers()
  }, [])
  return <section className="page-stack"><PageTitle title="مدیریت باشگاه" text="تصویر روشن از عملکرد و درآمد باشگاه." /><Message text={message} /><section className="metric-grid"><Metric label="اشتراک فعال" value={reports.subscriptions.active || 0} icon={Users} color="blue" /><Metric label="کل درآمد" value={formatPrice(reports.revenue.total_revenue || 0)} icon={CreditCard} color="green" /><Metric label="پرداخت موفق" value={reports.revenue.successful_payments || 0} icon={Check} color="purple" /></section>
    {overview && <AnalyticsOverview data={overview} />}
    {trends && <AnalyticsCharts trends={trends} />}
    <div className="content-grid"><Card title="محبوب‌ترین کلاس‌ها">{(reports.popular.popular_classes || []).map((item) => <div className="list-row" key={item.name}><span className="session-icon"><Dumbbell size={17} /></span><div><strong>{item.name}</strong><small>{item.category}</small></div><span className="capacity">{item.total_bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card><Card title="حضور در جلسات">{reports.attendance.map((item) => <div className="list-row" key={item.session_id}><div><strong>{item.gym_class}</strong><small>{formatDate(item.session_date)}</small></div><span className="capacity">{item.attendance} حضور / {item.bookings} رزرو</span></div>) || <Empty text="داده‌ای موجود نیست." />}</Card></div><UserManager users={users} members={members} trainers={trainers} onChanged={loadUsers} setMessage={setMessage} /></section>
}

/** The operational half of the admin report: rates rather than totals, and
 * two lists that are actually a to-do — who to call before they quit, and
 * whose subscription is about to lapse. */
function AnalyticsOverview({ data }) {
  const k = data.kpis
  const rates = [
    { label: 'نرخ حضور', value: k.attendance_rate, hint: 'از رزروها چند نفر واقعاً آمدند', good: k.attendance_rate >= 70 },
    { label: 'نرخ پر شدن ظرفیت', value: k.fill_rate, hint: 'از کل ظرفیت جلسات چقدر رزرو شد', good: k.fill_rate >= 50 },
    // `good` already encodes direction per metric — high attendance is good,
    // high churn is not — so there's no separate invert flag.
    { label: 'نرخ ریزش', value: k.churn_rate, hint: `${toPersianDigits(k.churned)} اشتراک در این بازه تمام شد`, good: k.churn_rate <= 10 },
  ]
  return <section className="analytics-overview">
    <div className="analytics-head">
      <div>
        <p className="eyebrow">گزارش عملکرد</p>
        <h3>{toPersianDigits(data.window_days)} روز گذشته</h3>
      </div>
      <div className="analytics-money">
        <span><strong>{formatPrice(k.revenue)}</strong><small>درآمد این بازه</small></span>
        <span><strong>{formatPrice(k.arpu)}</strong><small>درآمد به ازای هر عضو فعال</small></span>
      </div>
    </div>

    <div className="rate-grid">
      {rates.map((r) => (
        <div className="rate-card" key={r.label}>
          <div className="rate-top">
            <span>{r.label}</span>
            <strong className={r.good ? 'good' : 'bad'}>{toPersianDigits(r.value)}٪</strong>
          </div>
          <div className="rate-bar"><motion.div className={r.good ? 'good' : 'bad'} initial={{ width: 0 }} animate={{ width: `${Math.min(100, r.value)}%` }} transition={{ duration: .7, ease: 'easeOut' }} /></div>
          <small>{r.hint}</small>
        </div>
      ))}
      <div className="rate-card">
        <div className="rate-top">
          <span>اعضای فعال</span>
          <strong>{toPersianDigits(k.active_members)}</strong>
        </div>
        <small>از {toPersianDigits(k.total_members)} عضو ثبت‌شده · {toPersianDigits(k.new_members)} عضو جدید</small>
      </div>
    </div>

    <div className="content-grid">
      <Card title={`در معرض ریزش (${toPersianDigits(k.at_risk_count)})`}>
        <p className="reward-hint">اشتراک فعال دارند ولی در {toPersianDigits(data.window_days)} روز گذشته حتی یک بار نیامده‌اند. اینها را قبل از تمام شدن اشتراک بگیر.</p>
        {data.at_risk_members.length ? data.at_risk_members.map((m) => (
          <div className="list-row" key={m.member_id}>
            <span className="icon-chip orange"><UserX size={16} /></span>
            <div><strong>{m.full_name}</strong><small>{m.phone || 'بدون شماره'}</small></div>
            <span className="capacity">{m.days_since != null ? `${toPersianDigits(m.days_since)} روز پیش` : 'هرگز نیامده'}</span>
          </div>
        )) : <Empty text="همه اعضای فعال اخیراً آمده‌اند 👏" />}
      </Card>
      <Card title={`اشتراک‌های رو به اتمام (${toPersianDigits(k.expiring_soon)})`}>
        <p className="reward-hint">تا دو هفته آینده تمام می‌شوند — فرصت تمدید.</p>
        {data.expiring_subscriptions.length ? data.expiring_subscriptions.map((s, i) => (
          <div className="list-row" key={i}>
            <span className="icon-chip blue"><CreditCard size={16} /></span>
            <div><strong>{s.member_name}</strong><small>{s.plan_name}</small></div>
            <span className="capacity">{toPersianDigits(s.days_left)} روز مانده</span>
          </div>
        )) : <Empty text="اشتراکی در آستانه اتمام نیست." />}
      </Card>
    </div>

    <Card title="عملکرد کلاس‌ها">
      <p className="reward-hint">نرخ حضور یعنی از رزروکننده‌ها چند نفر آمدند؛ نرخ پر شدن یعنی از ظرفیت چقدر استفاده شد. کلاس با ظرفیت خالی و حضور پایین، کلاسی است که باید حذف یا جابه‌جا شود.</p>
      {data.class_performance.length ? <div className="class-perf">
        {data.class_performance.map((c) => (
          <div className="class-perf-row" key={c.name}>
            <div className="class-perf-name"><strong>{c.name}</strong><small>{c.category}</small></div>
            <div className="class-perf-bars">
              <div className="class-perf-bar">
                <span>حضور {toPersianDigits(c.attendance_rate)}٪</span>
                <div><motion.i initial={{ width: 0 }} animate={{ width: `${c.attendance_rate}%` }} transition={{ duration: .6 }} /></div>
              </div>
              <div className="class-perf-bar fill">
                <span>ظرفیت {toPersianDigits(c.fill_rate)}٪</span>
                <div><motion.i initial={{ width: 0 }} animate={{ width: `${c.fill_rate}%` }} transition={{ duration: .6 }} /></div>
              </div>
            </div>
            <span className="capacity">{toPersianDigits(c.attendance)} از {toPersianDigits(c.bookings)} رزرو</span>
          </div>
        ))}
      </div> : <Empty text="جلسه‌ای در این بازه برگزار نشده." />}
    </Card>
  </section>
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

  const [editing, setEditing] = useState(null)     // user being edited
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })
  const [confirmId, setConfirmId] = useState(null) // user pending deletion

  const startEdit = (u) => { setEditing(u.id); setEditForm({ full_name: u.full_name, phone: u.phone || '' }) }
  const saveEdit = async (id) => {
    try {
      await api.patch(`/auth/users/${id}/`, editForm)
      setEditing(null); setMessage('حساب به‌روزرسانی شد.'); onChanged()
    } catch (e) { setMessage(errorMessage(e)) }
  }
  const removeUser = async (id) => {
    try {
      await api.delete(`/auth/users/${id}/`)
      setConfirmId(null); setMessage('حساب حذف شد.'); onChanged()
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
      {users.length ? users.map((u) => {
        if (editing === u.id) return <div className="list-row user-edit-row" key={u.id}>
          <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="نام و نام خانوادگی" />
          <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="شماره تماس" />
          <button className="icon-button" title="ذخیره" onClick={() => saveEdit(u.id)}><Check size={16} /></button>
          <button className="icon-button" title="انصراف" onClick={() => setEditing(null)}><X size={16} /></button>
        </div>
        if (confirmId === u.id) return <div className="list-row confirm-bar" key={u.id}>
          <span>«{u.full_name}» و همه سوابقش (رزرو، حضور، برنامه‌ها و پرداخت‌ها) برای همیشه حذف شود؟</span>
          <button className="button muted" onClick={() => setConfirmId(null)}>انصراف</button>
          <button className="button danger" onClick={() => removeUser(u.id)}><Trash2 size={15} /> حذف</button>
        </div>
        return <div className="list-row" key={u.id}>
          <span className="avatar">{u.full_name?.[0]}</span>
          <div><strong>{u.full_name}</strong><small>{u.email} · {roleLabel[u.role]}</small></div>
          <span className={u.is_active ? 'status active' : 'status expired'}>{u.is_active ? 'فعال' : 'غیرفعال'}</span>
          <button className="icon-button" onClick={() => startEdit(u)} title="ویرایش"><Edit2 size={15} /></button>
          <button className="icon-button" onClick={() => toggleActive(u)} title={u.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}>{u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}</button>
          <button className="icon-button" onClick={() => setConfirmId(u.id)} title="حذف دائمی"><Trash2 size={15} /></button>
        </div>
      }) : <Empty text="کاربری ثبت نشده است." />}
      <p className="reward-hint user-manage-note">
        غیرفعال‌سازی جلوی ورود را می‌گیرد و سوابق را نگه می‌دارد — برای بیشتر موارد همان کافی است.
        حذف دائمی است و رزروها، حضورها و پرداخت‌های آن فرد را هم پاک می‌کند، پس گزارش‌های باشگاه هم تغییر می‌کنند.
      </p>
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
          <JalaliDateField label="تاریخ" value={sessionForm.session_date} onChange={(session_date) => setSessionForm({ ...sessionForm, session_date })} required />
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
  return <section className="page-stack"><PageTitle title="پروفایل من" text="اطلاعات حسابت را به‌روز نگه دار." /><Message text={message} /><Card title="اطلاعات شخصی"><form onSubmit={submit} className="form-grid two"><Field label="نام و نام خانوادگی" value={form.full_name} onChange={(full_name) => setForm({ ...form, full_name })} /><Field label="شماره تماس" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />{user.role === 'MEMBER' ? <><JalaliDateField label="تاریخ تولد" value={form.date_of_birth || ''} onChange={(date_of_birth) => setForm({ ...form, date_of_birth })} /><Field label="آدرس" value={form.address || ''} onChange={(address) => setForm({ ...form, address })} /></> : user.role === 'TRAINER' ? <><Field label="تخصص" value={form.specialization || ''} onChange={(specialization) => setForm({ ...form, specialization })} /><Field label="سال سابقه" type="number" value={form.experience_years || ''} onChange={(experience_years) => setForm({ ...form, experience_years })} /></> : null}<button className="button primary">ذخیره تغییرات <Check size={17} /></button></form></Card>
    <PrivacyCard user={user} setUser={setUser} setMessage={setMessage} />
    {user.role === 'MEMBER' && <FaceEnrollCard user={user} setUser={setUser} />}</section>
}

/** The two visibility switches, together in one place so it's obvious what
 *  each one does and that they're independent. */
/** iOS-style switch.
 *
 *  A real <button role="switch">, not a styled checkbox: it keeps keyboard
 *  and screen-reader behaviour without fighting the global input styles,
 *  and it can carry a pending state while the change is in flight. */
function Toggle({ checked, onChange, busy, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      className={`toggle ${checked ? 'on' : ''} ${busy ? 'busy' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}

function PrivacyCard({ user, setUser, setMessage }) {
  const member = user.role === 'MEMBER'
  const [profilePublic, setProfilePublic] = useState(user.is_profile_public !== false)
  const [onLeaderboard, setOnLeaderboard] = useState(user.member?.show_on_leaderboard !== false)
  const [pending, setPending] = useState(null)

  /** Flip immediately so the switch feels instant, then persist — and put
   *  it BACK if the server refuses. Without the rollback a failed request
   *  leaves the toggle showing a setting that was never saved, which is
   *  worse than not moving at all for something people rely on for privacy. */
  const persist = async (key, value, setLocal) => {
    const previous = !value
    setLocal(value)
    setPending(key)
    try {
      const { data } = await api.patch('/auth/me/', { [key]: value })
      setUser({ ...user, ...data })
      setMessage('ذخیره شد.')
    } catch (e) {
      setLocal(previous)
      setMessage(`ذخیره نشد: ${errorMessage(e)}`)
    } finally {
      setPending(null)
    }
  }

  return <Card title="حریم خصوصی">
    <div className="privacy-row">
      <Toggle
        checked={profilePublic}
        busy={pending === 'is_profile_public'}
        label="پروفایلم عمومی باشد"
        onChange={(v) => persist('is_profile_public', v, setProfilePublic)}
      />
      <span><strong>پروفایلم عمومی باشد</strong>
        <small>اگر خاموش کنی، بقیه فقط نام و سطحت را می‌بینند — کلاس‌هایی که رفته‌ای، آمار و فعالیتت پنهان می‌شود. خودت و مدیر باشگاه همیشه کامل می‌بینید.</small></span>
    </div>
    {member && <div className="privacy-row">
      <Toggle
        checked={onLeaderboard}
        busy={pending === 'show_on_leaderboard'}
        label="در جدول امتیازات نمایش داده شوم"
        onChange={(v) => persist('show_on_leaderboard', v, setOnLeaderboard)}
      />
      <span><strong>در جدول امتیازات نمایش داده شوم</strong>
        <small>اگر خاموش کنی، اسمت از رتبه‌بندی و از آرشیو نفرات برتر حذف می‌شود. امتیاز خودت همچنان محاسبه و به خودت نشان داده می‌شود.</small></span>
    </div>}
  </Card>
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

const emptyMeal = () => ({ key: Math.random(), meal_name: '', calories: '', description: '' })

/** Common Iranian meal slots, offered as one-tap starters so a trainer
 *  isn't typing "صبحانه" for the hundredth time. Calories are a starting
 *  point, always editable. */
const MEAL_PRESETS = [
  { meal_name: 'صبحانه', calories: 400 },
  { meal_name: 'میان‌وعده صبح', calories: 150 },
  { meal_name: 'ناهار', calories: 700 },
  { meal_name: 'میان‌وعده عصر', calories: 200 },
  { meal_name: 'شام', calories: 550 },
  { meal_name: 'وعده بعد تمرین', calories: 300 },
]

/** Build or edit a diet plan with real meals.
 *
 *  Replaces the old "quick create", which took a title and then silently
 *  invented a single 500-calorie meal called "وعده اصلی" — the trainer
 *  could never actually say what the member should eat. */
function DietPlanBuilder({ assignments, editingPlan, onSaved, onCancelEdit, onError }) {
  const isEdit = !!editingPlan
  const [member, setMember] = useState(editingPlan?.member || '')
  const [title, setTitle] = useState(editingPlan?.title || '')
  const [startDate, setStartDate] = useState(editingPlan?.start_date || todayIso())
  const [endDate, setEndDate] = useState(editingPlan?.end_date || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10))
  const [meals, setMeals] = useState(
    editingPlan?.items?.length
      ? editingPlan.items.map((m) => ({ key: Math.random(), meal_name: m.meal_name, calories: m.calories, description: m.description || '' }))
      : [emptyMeal()],
  )
  const [busy, setBusy] = useState(false)

  const updateMeal = (i, patch) => setMeals((prev) => prev.map((m, j) => j === i ? { ...m, ...patch } : m))
  const addMeal = (preset) => setMeals((prev) => [...prev, { ...emptyMeal(), ...(preset || {}) }])
  const removeMeal = (i) => setMeals((prev) => prev.filter((_, j) => j !== i))

  const totalCalories = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0)

  const submit = async (event) => {
    event.preventDefault()
    if (!member || !title) { onError('عضو و عنوان رژیم را مشخص کن.'); return }
    const filled = meals.filter((m) => m.meal_name.trim())
    if (!filled.length) { onError('حداقل یک وعده غذایی وارد کن.'); return }
    if (endDate < startDate) { onError('تاریخ پایان نمی‌تواند قبل از شروع باشد.'); return }
    setBusy(true)
    const payload = {
      member, title, start_date: startDate, end_date: endDate,
      items: filled.map((m) => ({ meal_name: m.meal_name.trim(), calories: Number(m.calories) || 0, description: m.description })),
    }
    try {
      if (isEdit) await api.patch(`/diet-plans/${editingPlan.id}/`, payload)
      else await api.post('/diet-plans/', payload)
      if (!isEdit) { setTitle(''); setMeals([emptyMeal()]) }
      onSaved(isEdit ? 'رژیم غذایی به‌روزرسانی شد.' : 'رژیم غذایی ساخته شد.')
    } catch (e) { onError(errorMessage(e)) } finally { setBusy(false) }
  }

  return <Card title={isEdit ? `ویرایش رژیم: ${editingPlan.title}` : 'ساخت رژیم غذایی'}>
    <form onSubmit={submit} className="workout-builder">
      <div className="inline-form">
        <select value={member} onChange={(e) => setMember(e.target.value)} disabled={isEdit}>
          <option value="">انتخاب عضو</option>
          {assignments.map((item) => <option key={item.id} value={item.member}>{item.member_name}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان رژیم" />
      </div>
      <div className="inline-form">
        <JalaliDateField label="از" value={startDate} onChange={setStartDate} />
        <JalaliDateField label="تا" value={endDate} onChange={setEndDate} />
      </div>

      <div className="meal-presets">
        <span>افزودن سریع:</span>
        {MEAL_PRESETS.map((p) => (
          <button type="button" className="chip" key={p.meal_name} onClick={() => addMeal(p)}>
            <Plus size={12} /> {p.meal_name}
          </button>
        ))}
      </div>

      {meals.map((meal, i) => (
        <div className="meal-row" key={meal.key}>
          <input value={meal.meal_name} onChange={(e) => updateMeal(i, { meal_name: e.target.value })} placeholder="نام وعده (مثلاً صبحانه)" />
          <input type="number" min="0" value={meal.calories} onChange={(e) => updateMeal(i, { calories: e.target.value })} placeholder="کالری" />
          <input value={meal.description} onChange={(e) => updateMeal(i, { description: e.target.value })} placeholder="جزئیات: مثلاً ۲ عدد تخم‌مرغ + نان سنگک" />
          {meals.length > 1 && <button type="button" className="icon-button" onClick={() => removeMeal(i)}><X size={14} /></button>}
        </div>
      ))}

      <div className="meal-total">
        <span>مجموع کالری روزانه</span>
        <strong>{toPersianDigits(totalCalories)}</strong>
      </div>

      <div className="inline-form">
        <button type="button" className="button muted" onClick={() => addMeal()}><Plus size={16} /> وعده خالی</button>
        <button className="button primary" disabled={busy}><Check size={16} /> {isEdit ? 'ذخیره تغییرات' : 'ساخت رژیم'}</button>
        {isEdit && <button type="button" className="button muted" onClick={onCancelEdit}>انصراف</button>}
      </div>
    </form>
  </Card>
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
            <JalaliDateField label="" value={day.date} onChange={(date) => updateDay(dayIndex, { date })} required />
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



/** A real Jalali date picker.
 *
 *  The previous version wrapped `<input type="date">` and printed the
 *  Persian equivalent underneath. That kept the OS picker — which renders
 *  in the BROWSER's locale, so an Iranian user still picked their dates off
 *  a Gregorian grid. This one is a Jalali month grid: the value stays an
 *  ISO date on the wire (the API speaks Gregorian) while everything the
 *  user sees and clicks is Shamsi. */
function JalaliDateField({ label, value, onChange, required }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const today = new Date()
  const [todayJy, todayJm, todayJd] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const selected = useMemo(() => {
    if (!value) return null
    const [gy, gm, gd] = value.split('-').map(Number)
    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd)
    return { jy, jm, jd }
  }, [value])

  const [viewYear, setViewYear] = useState(selected?.jy ?? todayJy)
  const [viewMonth, setViewMonth] = useState(selected?.jm ?? todayJm)

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const monthLen = jalaliMonthLength(viewYear, viewMonth)
  const [firstGy, firstGm, firstGd] = jalaliToGregorian(viewYear, viewMonth, 1)
  const leadingBlanks = (new Date(firstGy, firstGm - 1, firstGd).getDay() + 1) % 7
  const monthLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long' })
    .format(new Date(firstGy, firstGm - 1, firstGd))

  const prev = () => viewMonth === 1 ? (setViewYear(viewYear - 1), setViewMonth(12)) : setViewMonth(viewMonth - 1)
  const next = () => viewMonth === 12 ? (setViewYear(viewYear + 1), setViewMonth(1)) : setViewMonth(viewMonth + 1)
  const choose = (jd) => {
    const [gy, gm, gd] = jalaliToGregorian(viewYear, viewMonth, jd)
    onChange(isoDate(gy, gm, gd))
    setOpen(false)
  }

  return <div className="jalali-field" ref={boxRef}>
    {label && <span className="jalali-field-label">{label}</span>}
    <button type="button" className={`jalali-trigger ${!value ? 'empty' : ''}`} onClick={() => setOpen((v) => !v)}>
      <CalendarDays size={15} />
      {value ? formatDate(value) : 'انتخاب تاریخ'}
    </button>
    {/* Keeps native form validation working even though the control is custom. */}
    <input type="hidden" value={value || ''} required={required} readOnly />
    {open && <div className="jalali-pop">
      <div className="jalali-pop-head">
        <button type="button" className="icon-button" onClick={next}><ChevronRight size={15} /></button>
        <strong>{monthLabel}</strong>
        <button type="button" className="icon-button" onClick={prev}><ChevronLeft size={15} /></button>
      </div>
      <div className="jalali-grid">
        {WEEKDAY_LABELS_SAT_FIRST.map((w) => <span className="jalali-weekday" key={w}>{w}</span>)}
        {Array(leadingBlanks).fill(null).map((_, i) => <span key={`b-${i}`} />)}
        {Array.from({ length: monthLen }, (_, i) => i + 1).map((jd) => {
          const isSelected = selected && selected.jy === viewYear && selected.jm === viewMonth && selected.jd === jd
          const isToday = todayJy === viewYear && todayJm === viewMonth && todayJd === jd
          return <button
            type="button" key={jd}
            className={`jalali-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => choose(jd)}
          >{toPersianDigits(jd)}</button>
        })}
      </div>
      <button type="button" className="text-button jalali-today-btn" onClick={() => {
        setViewYear(todayJy); setViewMonth(todayJm); choose(todayJd)
      }}>امروز</button>
    </div>}
  </div>
}

function PageTitle({ title, text }) { return <div className="page-title"><div><h2>{title}</h2><p>{text}</p></div></div> }
function Card({ title, children, action, actionButton }) { const navigate = useNavigate(); const { t } = useLang(); return <section className="content-card "><header><h3>{title}</h3>{actionButton || (action && <button className="text-button" onClick={() => navigate(action)}>{t('مشاهده همه')}</button>)}</header>{children}</section> }
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
