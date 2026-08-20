# Tanasob Smart Gym — نقشه راه پروژه (Roadmap)

> **هدف:** این فایل رفرنس اصلی پروژه‌ست. اگه لیمیت هوش مصنوعی تموم شد، از همین فایل بفهم کجای کاریم و تسک بعدی چیه. هر تسک رو یکی‌یکی تیک بزن.

---

## 📌 اطلاعات کلی پروژه

| مورد | مقدار |
|------|-------|
| نام پروژه | Tanasob Smart Gym Management System |
| دانشجو | Farid Kiaeieh |
| استاد | Mostafa Bastam |
| بک‌اند | Django 5.2 + Django REST Framework |
| فرانت‌اند | React (Vite) |
| احراز هویت | JWT (SimpleJWT) |
| دیتابیس (توسعه) | SQLite (تنظیمات PostgreSQL کامنت شده) |
| venv | `/Users/farid/Desktop/venv` |
| مسیر پروژه | `/Users/farid/Desktop/tanasob` |
| مستند SRS | `/Users/farid/Downloads/Smart_Gym_SRS.docx` |

### نقش‌ها (Roles)
- **MEMBER** — عضو باشگاه (رزرو کلاس، خرید اشتراک، برنامه تمرین/رژیم، چت، ثبت پیشرفت)
- **TRAINER** — مربی (مدیریت جلسات، ساخت برنامه، چت، ثبت حضور غیاب)
- **ADMIN** — مدیر سیستم (مدیریت کامل + گزارش‌ها)

---

## 🗂 ساختار Appهای بک‌اند

```
tanasob/                  # پروژه جنگو (settings, urls)
accounts/                 # User, Member, Trainer, TrainerMemberAssignment + احراز هویت
memberships/              # MembershipPlan, Subscription, Payment (mock)
classes/                  # GymClass, ClassSession
bookings/                 # Booking, Attendance
plans/                    # WorkoutPlan, WorkoutPlanItem, DietPlan, DietPlanItem
progress/                 # BodyProgress
messaging/                # Message
notifications/            # Notification
reports/                  # گزارش‌های ادمین (بدون مدل، aggregation)
common/                   # permissions و helpers مشترک
```

---

## ✅ فاز ۱: بک‌اند (Django + DRF)

### **[T1] کانفیگ اولیه پروژه** — `settings.py`
- [x] اضافه‌کردن INSTALLED_APPS: rest_framework, simplejwt, corsheaders, django_filter, drf_spectacular + appها
- [x] تنظیم REST_FRAMEWORK (default auth class = JWT)
- [x] تنظیم SIMPLE_JWT (access + refresh lifetime)
- [x] تنظیم CORS (برای React روی localhost:5173)
- [x] `AUTH_USER_MODEL = 'accounts.User'`
- [x] دیتابیس SQLite (+ کامنت PostgreSQL)
- [x] ** تست:** `python manage.py check` بدون خطا

### **[T2] app `accounts` — مدل‌ها**
- [x] `UserManager` (create / create_superuser با ایمیل)
- [x] `User(AbstractBaseUser, PermissionsMixin)`: email, full_name, phone, role(MEMBER/TRAINER/ADMIN), created_at, is_active, is_staff
- [x] `Member` (1:1 → User): date_of_birth, gender, address
- [x] `Trainer` (1:1 → User): specialization, bio, experience_years
- [x] `TrainerMemberAssignment`: member, trainer, status(ACTIVE/ENDED), assigned_at
- [x] signals: ساختن خودکار Member/Trainer بعد از ثبت‌نام بر اساس role
- [x] ثبت در admin

### **[T3] app `accounts` — احراز هویت و پروفایل**
- [x] serializers: RegisterSerializer, LoginSerializer (JWT), UserSerializer, MemberSerializer, TrainerSerializer
- [x] views: POST `/auth/register/`, POST `/auth/login/`, POST `/auth/token/refresh/`, GET/PATCH `/auth/me/`
- [x] POST `/auth/change-password/`
- [x] permissions مشترک در `common/permissions.py`: IsAdmin, IsTrainer, IsMember
- [ ] ** تست:** ثبت‌نام عضو، ورود، گرفتن توکن، گرفتن پروفایل

### **[T4] app `memberships` — مدل‌ها**
- [x] `MembershipPlan`: name, duration_days, price, description, is_active
- [x] `Subscription`: member, plan, start_date, end_date, status(ACTIVE/EXPIRED/CANCELLED)
- [x] `Payment`: subscription, amount, method(MOCK_GATEWAY), status(SUCCESS/FAILED/PENDING), transaction_ref, paid_at
- [x] ** تست:** ساخت migration

### **[T5] app `memberships` — منطق و API**
- [x] Admin: CRUD `/plans/` (MembershipPlan)
- [x] Member: GET `/plans/` (فهرست پلن‌ها)، POST `/subscribe/` (mock payment → ساخت Subscription + Payment)
- [x] Member: GET `/subscriptions/me/`, GET `/payments/me/`
- [x] Admin: GET `/admin/subscriptions/`, GET `/admin/payments/`
- [x] متد کمکی: `is_active()` برای عضو (آیا اشتراک فعال دارد؟) + auto-expire
- [ ] ** تست:** خرید اشتراک موفق، رد رزرو عضو بدون اشتراک

### **[T6] app `classes` — مدل‌ها**
- [x] `GymClass`: name, category, description
- [x] `ClassSession`: gym_class, trainer, session_date, start_time, end_time, capacity
- [x] validator: جلوگیری از تداخل زمانی یک مربی (FR-CLS-4)

### **[T7] app `classes` — API**
- [x] Admin: CRUD `/classes/`، CRUD `/sessions/`
- [x] Member: GET `/sessions/` با فیلتر (class, trainer, date) — django-filter
- [x] محاسبه capacity پر شده (booked_count)
- [ ] ** تست:** جلوگیری از تداخل زمانی مربی

### **[T8] app `bookings` — مدل‌ها**
- [x] `Booking`: member, session, status(CONFIRMED/CANCELLED), booked_at
- [x] `Attendance`: member, session, check_in_time
- [x] constraint: یک عضو یک رزرو فعال برای هر session (FR-BOOK-4)

### **[T9] app `bookings` — API**
- [x] Member: POST `/bookings/` (بررسی اشتراک فعال + ظرفیت + یک‌بار)
- [x] Member: POST `/bookings/{id}/cancel/`
- [x] Member: POST `/attendance/check-in/` (self check-in)
- [x] Trainer/Admin: GET attendance history (per session / per member)
- [x] signal: ساخت Notification بعد از رزرو/کنسلی
- [ ] ** تست:** رزرو وقتی ظرفیت پره رد میشه

### **[T10] app `plans` — مدل‌ها**
- [x] `WorkoutPlan` + `WorkoutPlanItem` (exercise_name, sets, reps, notes)
- [x] `DietPlan` + `DietPlanItem` (meal_name, calories, description)
- [x] هر دو: member, trainer, title, start_date, end_date, is_archived

### **[T11] app `plans` — API**
- [x] Trainer: CRUD روی planهای عضوانی که بهش assign شدن
- [x] Member: GET `/plans/me/workouts/`, `/plans/me/diets/`
- [x] Trainer: POST `/plans/{id}/archive/`
- [ ] ** تست:** مربی فقط برای اعضای خودش برنامه میسازه

### **[T12] app `progress` — BodyProgress**
- [x] مدل: member, recorded_at, weight_kg, body_fat_percent, waist_cm, notes
- [x] Member: POST (ثبت)، GET (تاریخچه خودش)
- [x] Trainer: GET progress اعضای خودش
- [ ] ** تست:** ثبت و خواندن پیشرفت

### **[T13] app `messaging` — چت**
- [x] مدل `Message`: sender, receiver, content, sent_at, is_read
- [x] API: GET conversation با یک کاربر، POST send، POST mark-read
- [x] فقط بین عضو و مربیِ assign شده مجازه (اعتبارسنجی)
- [x] signal: Notification پیام جدید
- [ ] ** تست:** ارسال پیام و دیدن thread

### **[T14] app `notifications`**
- [x] مدل `Notification`: user, title, message, type, is_read, created_at
- [x] GET `/notifications/`, POST `/notifications/{id}/read/`, POST `/notifications/read-all/`
- [x] GET `/notifications/unread-count/`
- [ ] ** تست:** لیست و خواندن

### **[T15] app `reports` (Admin)**
- [x] GET `/reports/subscriptions/` (active vs expired)
- [x] GET `/reports/revenue/` (با بازه تاریخ ?from=&to=)
- [x] GET `/reports/attendance/` (آمار حضور غیاب sessionها)
- [x] GET `/reports/popular/` (پرطرفدارترین classes/trainers)
- [ ] ** تست:** خروجی JSON گزارش‌ها

### **[T16] جمع‌بندی نهایی بک‌اند**
- [x] سیم‌کشی همه URLها در `tanasob/urls.py`
- [x] drf-spectacular schema در `/api/docs/` (Swagger)
- [x] `seed` management command (دیتای نمونه: admin + trainers + members + plans + classes)
- [x] makemigrations + migrate + runserver موفق
- [x] فایل `.env.example` و `requirements.txt`
- [ ] ** تست پایانی:** لاگین ۳ نقش و چند endpoint

---

## 🎨 فاز ۲: فرانت‌اند (React) — بعداً

> وقتی بک‌اند تمام شد، اینجا شروع می‌کنیم.

- [x] **[F1]** ساخت پروژه Vite + React + axios + react-router؛ لایه API و refresh خودکار JWT
- [x] **[F2]** صفحات ورود/ثبت‌نام + ذخیره JWT
- [x] **[F3]** لایوت داشبورد + routing بر اساس نقش + هدر/سایدبار
- [x] **[F4]** صفحات Member: خانه، خرید اشتراک، فهرست کلاس‌ها + رزرو، برنامه‌ها، پیشرفت بدن، چت، اعلان‌ها
- [x] **[F5]** پنل Trainer: جلسات من، اعضای من، ساخت برنامه، چت، ثبت حضور
- [x] **[F6]** پنل Admin: گزارش اشتراک، درآمد، حضور و کلاس‌های محبوب
- [x] **[F7]** رابط واکنش‌گرا، تم روشن/تیره و طراحی glass؛ تست build موفق

---

## 🚀 نحوه اجرا (بعد از تکمیل)

```bash
cd /Users/farid/Desktop/tanasob
source /Users/farid/Desktop/venv/bin/activate
python manage.py makemigrations
python manage.py migrate
python manage.py seed           # دیتای نمونه
python manage.py createsuperuser
python manage.py runserver
# API docs: http://127.0.0.1:8000/api/docs/
```

---

## 📊 وضعیت فعلی
- **در حال اجرا:** فاز ۲ (نسخه اول فرانت‌اند آماده است؛ تست‌های یکپارچه API باقی مانده‌اند)
- **تسک جاری:** تست دستی جریان‌های سه نقش و تکمیل CRUDهای مدیریتی در صورت نیاز
