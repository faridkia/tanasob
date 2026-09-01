"""
The member's daily nudge: what to do today, and one thing worth knowing.

Two deliberate design choices:

1. **Rules, not a language model.** Every line here is derived from data the
   member can verify (their own attendance, plan, subscription). A wrong
   nudge from a rule is a bug we can fix; a wrong nudge from a model is a
   coin flip. Speed and predictability matter more than phrasing for
   something that renders on every dashboard load.

2. **Nothing is stored.** Tasks tick themselves from real records — a
   workout counts as done because there is an ActivityLog for today, not
   because someone pressed a checkbox. That means the checklist can never
   drift out of sync with reality, and there is no per-member-per-day table
   to write, prune or migrate. Same principle the leaderboard already uses.
"""

from datetime import timedelta

from django.utils import timezone


def _today_workout(member, today):
    """The workout day scheduled for today, if the member has one."""
    from plans.models import WorkoutDay

    return (
        WorkoutDay.objects.filter(
            workout_plan__member=member,
            workout_plan__is_archived=False,
            date=today,
        )
        .select_related('workout_plan')
        .prefetch_related('items')
        .first()
    )


def daily_tasks(member):
    """Today's checklist. Each entry is derived and self-ticking."""
    from bookings.models import Booking
    from activities.models import ActivityLog

    from .models import BodyProgress

    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    user = member.user

    workout_day = _today_workout(member, today)
    trained_today = ActivityLog.objects.filter(
        member=member, created_at__date=today,
    ).exists()
    # BodyProgress stores the date the member says the measurement is for
    # (`recorded_at`, a DateField), not when the row was written — so this
    # compares against the date directly, with no __date lookup.
    logged_body = BodyProgress.objects.filter(member=member, recorded_at=today).exists()
    booked_this_week = Booking.objects.filter(
        member=member,
        status=Booking.Status.CONFIRMED,
        session__session_date__gte=week_start,
    ).exists()
    profile_complete = bool(user.phone and member.date_of_birth)

    tasks = []
    if workout_day:
        tasks.append({
            'key': 'workout',
            'label': workout_day.label or 'تمرین امروز',
            'hint': f'{workout_day.items.count()} حرکت',
            'done': trained_today,
            'action': f'/workout/{workout_day.workout_plan_id}/{workout_day.id}',
        })
    else:
        tasks.append({
            'key': 'move',
            'label': 'امروز یک فعالیت ثبت کن',
            'hint': 'تمرینی برای امروز نداری — یک پیاده‌روی هم حساب می‌شود',
            'done': trained_today,
            'action': '/walk',
        })
    tasks.append({
        'key': 'body', 'label': 'ثبت وزن و اندازه‌ها',
        'hint': 'هفته‌ای یک بار کافی است', 'done': logged_body, 'action': '/progress',
    })
    tasks.append({
        'key': 'book', 'label': 'رزرو کلاس این هفته',
        'hint': 'یک جلسه گروهی برای این هفته', 'done': booked_this_week, 'action': '/classes',
    })
    if not profile_complete:
        tasks.append({
            'key': 'profile', 'label': 'تکمیل پروفایل',
            'hint': 'شماره تماس و تاریخ تولد', 'done': False, 'action': '/profile',
        })

    done = sum(1 for t in tasks if t['done'])
    return tasks, done


def suggestions(member):
    """Ranked nudges — most useful first. The dashboard shows the top one.

    Ordering is by consequence, not by chattiness: something expiring or a
    discount about to be wasted outranks encouragement.
    """
    from bookings.models import Attendance
    from memberships.models import LeaderboardReward
    from memberships.services import get_active_subscription

    from .gamification import goals_for_member, points_for_member

    today = timezone.localdate()
    out = []

    # 1. Money on the table: an unredeemed discount.
    reward = LeaderboardReward.objects.filter(member=member, is_redeemed=False).order_by('-percent').first()
    if reward:
        out.append({
            'tone': 'gold', 'icon': 'trophy',
            'text': f'{reward.percent}٪ تخفیف استفاده‌نشده داری — بابت رتبه {reward.rank} جدول امتیازات.',
            'action': '/membership', 'action_label': 'مشاهده پلن‌ها',
        })

    # 2. Subscription about to lapse.
    subscription = get_active_subscription(member)
    if subscription:
        days_left = (subscription.end_date - today).days
        if days_left <= 10:
            out.append({
                'tone': 'warn', 'icon': 'card',
                'text': f'اشتراکت {days_left} روز دیگر تمام می‌شود.',
                'action': '/membership', 'action_label': 'تمدید',
            })

    # 3. Been away a while. Uses the same signal the admin's at-risk report
    #    does, pointed back at the member instead of at the owner.
    last = (
        Attendance.objects.filter(member=member)
        .order_by('-check_in_time').values_list('check_in_time', flat=True).first()
    )
    if last:
        away = (today - last.date()).days
        if away >= 7:
            out.append({
                'tone': 'warn', 'icon': 'flame',
                'text': f'{away} روز است که نیامده‌ای. یک جلسه‌ی کوتاه هم بهتر از هیچ است.',
                'action': '/classes', 'action_label': 'رزرو کلاس',
            })

    # 4. Close to the next tier.
    points = points_for_member(member)
    nxt = points.get('next_tier')
    if nxt and nxt['sessions_needed'] <= 10:
        out.append({
            'tone': 'accent', 'icon': 'award',
            'text': f"{nxt['sessions_needed']} جلسه تا سطح {nxt['tier']} {nxt['tier_emoji']} و {nxt['discount']}٪ تخفیف دائمی فاصله داری.",
            'action': '/leaderboard', 'action_label': 'جدول امتیازات',
        })

    # 5. Weekly goal within reach.
    goals = goals_for_member(member)
    remaining = goals['weekly']['target'] - goals['weekly']['count']
    if 0 < remaining <= 2:
        out.append({
            'tone': 'accent', 'icon': 'target',
            'text': f'فقط {remaining} جلسه تا هدف هفتگی‌ات مانده 💪',
            'action': '/calendar', 'action_label': 'تقویم من',
        })
    elif remaining <= 0 and goals['weekly']['target']:
        out.append({
            'tone': 'good', 'icon': 'check',
            'text': 'هدف هفتگی‌ات را زده‌ای! هفته‌ی خوبی بود 🎉',
            'action': '/leaderboard', 'action_label': 'امتیازها',
        })

    if not out:
        out.append({
            'tone': 'accent', 'icon': 'target',
            'text': 'برای شروع، یک کلاس این هفته رزرو کن.',
            'action': '/classes', 'action_label': 'کلاس‌ها',
        })
    return out
