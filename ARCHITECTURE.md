# Tanasob — Codebase Walkthrough (for presenting)

Django 5 + DRF backend, React (Vite) SPA frontend, JWT auth, one app per
bounded context. Each app follows the same layering: `models.py` (data +
invariants) → `serializers.py` (wire format) → `views.py` (thin, permission
checks) → `services.py` (multi-step business logic, kept out of views so it's
testable/reusable in isolation).

Two ways to skim this: read app-by-app top to bottom, or jump straight to
**"Where business rules actually live"** near the end — that's the part
worth walking your professor through slowly, since it's the one architectural
decision that shows up everywhere.

---

## `accounts` — identity

```
User (AbstractBaseUser)
 ├─ 1:1 → Member    (only if role == MEMBER)
 ├─ 1:1 → Trainer   (only if role == TRAINER)
 └─ (Admin has no profile table — role alone is enough)

TrainerMemberAssignment  — M2M junction, Member ↔ Trainer, with a status
```

- `User` is a custom auth model (`email` as `USERNAME_FIELD`, no `username`),
  with `role` as a plain `TextChoices` field rather than Django's
  group/permission system — deliberate, since there are exactly 3 roles and
  every permission check in the project is a hard `if user.is_member` /
  `IsAdmin` class, not a fine-grained permission matrix. `is_member` /
  `is_trainer` / `is_admin_role` are `@property` helpers on `User`, so
  `request.user.is_member` reads naturally in every view instead of
  `request.user.role == User.Role.MEMBER` everywhere.
- **Member/Trainer profile creation is signal-driven** (`accounts/signals.py`,
  `post_save` on `User`) — register a user with `role=TRAINER` and the
  `Trainer` row appears automatically. Keeps `RegisterSerializer` from
  needing to branch on role for profile creation.
- `Member.qr_token` — a `UUIDField`, separate from the PK, `unique=True`,
  `editable=False`. This is the payload encoded in the member's QR check-in
  card. Deliberately *not* the Member's PK: a sequential integer PK would let
  anyone enumerate other members' check-in codes by incrementing a number;
  a random UUID doesn't.
- `TrainerMemberAssignment` has `unique_together = ('member', 'trainer')` —
  the M2M junction table pattern, explicit rather than a bare
  `ManyToManyField`, because it carries its own state (`status`:
  ACTIVE/ENDED) and `assigned_at` timestamp that a plain M2M can't hold
  without a `through=` model anyway — so it's just modeled directly.

## `memberships` — plans, subscriptions, mock payments

```
MembershipPlan  →  Subscription  →  Payment
 (1:N)              (1:N)
```

- `Subscription.plan` uses `on_delete=PROTECT` — you cannot delete a
  `MembershipPlan` that has any subscription referencing it, even an expired
  one. Financial/historical records shouldn't silently cascade-delete.
- `Subscription.refresh_status()` / `is_currently_active` — lazy expiry:
  rather than a scheduled job flipping `status` to `EXPIRED` at midnight,
  the status is checked (and corrected in the DB) the moment anything reads
  it. `has_active_subscription()` / `get_active_subscription()` in
  `services.py` are the two functions everything else in the project calls
  instead of ever querying `Subscription.status` directly.
- `purchase_subscription(member, plan)` in `services.py` is the one function
  worth reading end to end: wrapped in `@transaction.atomic`, it (1) refuses
  a second concurrent ACTIVE subscription, (2) rolls a random number against
  `MOCK_PAYMENT_FAILURE_RATE` to simulate a real gateway's success/failure,
  (3) creates `Subscription` + `Payment` together, and (4) raises on failure
  *after* both rows exist — so a "failed" mock payment is still recorded,
  with a `CANCELLED` subscription and `FAILED` payment, not silently
  dropped.

## `classes` — the catalog vs. the calendar

```
GymClass (category, e.g. "Yoga")  →  ClassSession (a specific date+time+trainer+capacity)
```

Split deliberately: `GymClass` is what you'd see in a "browse classes" page;
`ClassSession` is what you actually book. This is the classic
"product vs. product variant" shape.

- `ClassSession.trainer` uses `on_delete=PROTECT` — same reasoning as
  `Subscription.plan`: a trainer with session history shouldn't be
  deletable out from under attendance/booking records.
- `ClassSession.clean()` enforces two invariants at the model layer (not the
  serializer or a service): `start_time < end_time`, and — the more
  interesting one — **no two sessions for the same trainer overlap in
  time**, checked by querying same-trainer/same-date sessions and testing
  interval overlap (`self.start < other.end and other.start < self.end`).
  `save()` is overridden to call `self.full_clean()` before
  `super().save()`, so this invariant holds for *every* write path —
  admin panel, Django shell, management command, not just the one DRF view
  that happens to call `.full_clean()` explicitly.
- `booked_count` / `is_full` / `remaining_capacity` are `@property`, computed
  from the reverse `bookings` relation at read time rather than stored as a
  counter column — no risk of the counter drifting out of sync with actual
  `Booking` rows, at the cost of a `COUNT` query per access (fine at this
  scale; would denormalize if it weren't).

## `bookings` — reservations and attendance are separate concerns

```
Booking     — member reserved a session (CONFIRMED / CANCELLED)
Attendance  — member actually showed up (created independently, not derived from Booking)
```

Both have `unique_together = ('member', 'session')` — one booking and one
attendance record per member per session, enforced at the DB level via a
unique constraint, not just application logic.

- Same `full_clean()`-in-`save()` pattern as `ClassSession`: `Booking.clean()`
  checks capacity (`FR-BOOK-2`) for *new* bookings only (`if not self.pk`) —
  so an already-CONFIRMED booking doesn't get invalidated retroactively if
  the session capacity changes later.
- The real booking rules live in `services.py`, not the model, because they
  need cross-model checks the model itself shouldn't know about:
  `create_booking()` checks `has_active_subscription` (a `memberships`
  concern) inside `@transaction.atomic`, re-checks `session.is_full` *inside*
  the transaction to close a race window between the initial check and the
  insert, then fires a `notify()` call. `cancel_booking()` computes the
  session's actual start datetime (`timezone.make_aware(datetime.combine(...))`)
  to enforce "can't cancel after it started" — this couldn't live in
  `Booking.clean()` cleanly since it's a time-of-cancellation check, not a
  state-invariant check.
- Attendance is intentionally not "derived" from Booking — a trainer can
  mark someone present (or a member self-check-in, or a QR scan) whether or
  not they booked ahead of time; `bookings/views.py::CheckInView` resolves
  the member three ways (self, by `member` id for trainer, by `token` for a
  scanned QR code — see below) and does a plain `get_or_create`, returning
  `201` vs `200` depending on whether it was new. That status-code
  distinction is what the frontend uses to show "checked in" vs. "already
  checked in" instead of one generic message.

## `plans` — workout & diet plans (structurally identical)

```
WorkoutPlan → WorkoutPlanItem (exercise_name, sets, reps, notes)
DietPlan    → DietPlanItem    (meal_name, calories, description)
```

Two parallel plan/item pairs rather than one polymorphic model — deliberate:
the item shapes genuinely differ (sets/reps vs. calories), and Django's
options for polymorphism (multi-table inheritance, a generic JSON payload)
would add real complexity for two models that will never need a third
sibling. The frontend *does* unify them behind one `PLAN_KINDS` config object
(shared list/detail-modal component, parameterized by which fields to
render) — the duplication is pushed to the one place it's cheap (two similar
Django models) rather than the one place it'd be expensive (a generic
"Plan" abstraction leaking into every serializer and permission check).

- `image` (`ImageField`, nullable) on both — a trainer-attached reference
  photo, uploaded through a *separate* endpoint
  (`POST /workout-plans/<id>/image/`) from the plan's own create/update, so
  the multipart image upload never has to coexist with the nested
  `items=[...]` JSON array in one request body.
- Serializers handle nested item writes manually
  (`WorkoutPlanSerializer.create/update`: pop `items`, delete-then-recreate
  on update) rather than via DRF's `ListSerializer` nested-write support,
  which is notoriously awkward for anything beyond flat create. Simple and
  correct for this scale; would reach for `drf-writable-nested` or a
  proper diffing update if items needed to preserve identity across edits.

## `progress` — the simplest model in the project

`BodyProgress`: `member`, `recorded_at`, `weight_kg`, `body_fat_percent`,
`waist_cm`, `notes`. No FK out beyond `member`, no state machine, nothing to
say — which is itself worth noting to a professor: not everything needs a
service layer. This one's a straight `ModelViewSet`-shaped CRUD.

## `messaging` / `notifications` — thin, and deliberately

`Message`: `sender`/`receiver` both point at the base `User` (not `Member`/
`Trainer`), since either role can be either party. A conversation is just
"all messages where (sender, receiver) or (receiver, sender) match this
pair" — no separate `Conversation` model; the pair *is* the thread key,
resolved with `?with=<user_id>` on the list endpoint.

`Notification` is a single flat model (`type` enum: SUBSCRIPTION / BOOKING /
MESSAGE / SESSION_REMINDER) created via one shared `notify(user, title,
message, type_)` helper in `notifications/services.py`, called from
`bookings/services.py` (on booking confirm/cancel) and `messaging/views.py`
(on new message) — every other app that wants to notify a user imports this
one function rather than importing `Notification` directly, so the shape
stays consistent no matter which app is triggering it.

## `assistant` — the odd one out, and why it's shaped that way

`ChatMessage`: `user`, `role` (USER/ASSISTANT), `content`, `created_at` — a
flat conversation log, no `Conversation` wrapper, since each user has
exactly one running thread with the assistant (unlike `messaging`, which
needs the `with=` pairing because a user has *multiple* conversation
partners).

The interesting part isn't the model, it's `assistant/services.py::
ask_assistant()`: it builds a **per-role system prompt with real data
injected** — a member's prompt includes their actual active subscription,
upcoming bookings, and plan counts (pulled via ORM queries against
`memberships`/`bookings`/`plans`), a trainer's includes their assigned-member
count and upcoming sessions, an admin's includes subscription/revenue
counts — then calls out to an OpenAI-chat-completions-shaped HTTP endpoint
(`requests.post`, one silent retry on connection reset) configured entirely
through env vars (`AI_LLM_API_BASE/KEY/MODEL/AUTH_SCHEME`), so swapping the
LLM provider is a config change, not a code change.

---

## Where business rules actually live (the one thing worth dwelling on)

There are two competing places an invariant can live in this codebase, and
the split is consistent on purpose:

1. **`Model.clean()` + `save()` override calling `full_clean()`** — for
   invariants that are properties of the row itself, regardless of *how*
   it's being written (API, Django admin, shell, a future management
   command). Used in `ClassSession` (time ordering, trainer overlap) and
   `Booking` (capacity on create). These fire no matter what touches the
   table.

2. **`services.py` functions wrapped in `@transaction.atomic`** — for rules
   that need to read/write *across* models, or that need a real transaction
   to close a race window (`create_booking`'s in-transaction capacity
   re-check), or that have externally-visible side effects beyond the DB
   write (`notify()` calls, the mock payment's random success/failure).
   These are only invoked from the one API entry point that's supposed to
   trigger them — by design, *not* from `Model.clean()`, since something
   like "send a notification" has no business happening as a side effect of
   `full_clean()` being called from an unrelated context (e.g., a data
   migration touching the table).

If asked "why isn't `create_booking`'s logic just in `Booking.clean()`
too?" — that's the answer: `clean()` runs on *every* save from *anywhere*,
including places you don't want a notification fired or a subscription
check re-run (bulk imports, fixture loading, admin bulk actions). Business
processes that should only happen once, from one deliberate entry point,
belong in a service function; structural invariants that must hold
*always* belong in the model.
