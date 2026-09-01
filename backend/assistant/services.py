
from django.conf import settings
from django.utils import timezone

import requests

from .models import ChatMessage

HISTORY_LIMIT = 20


class AssistantError(RuntimeError):
    pass


def _member_context(user):
    from bookings.models import Booking
    from memberships.services import get_active_subscription
    from plans.models import DietPlan, WorkoutPlan
    from progress.models import BodyProgress

    member = user.member_profile
    lines = [f'کاربر فعلی: {user.full_name} (نقش: عضو باشگاه).']

    subscription = get_active_subscription(member)
    if subscription:
        lines.append(
            f'اشتراک فعال: پلن «{subscription.plan.name}» تا تاریخ {subscription.end_date}.'
        )
    else:
        lines.append('این عضو در حال حاضر اشتراک فعالی ندارد.')

    upcoming = (
        Booking.objects.filter(member=member, status=Booking.Status.CONFIRMED)
        .select_related('session__gym_class')
        .order_by('session__session_date')[:5]
    )
    if upcoming:
        items = ', '.join(f'{b.session.gym_class.name} در {b.session.session_date}' for b in upcoming)
        lines.append(f'کلاس‌های رزرو شده: {items}.')
    else:
        lines.append('این عضو در حال حاضر هیچ کلاسی رزرو نکرده است.')

    workouts = WorkoutPlan.objects.filter(member=member, is_archived=False).count()
    diets = DietPlan.objects.filter(member=member, is_archived=False).count()
    lines.append(f'برنامه‌های فعال: {workouts} برنامه تمرینی، {diets} رژیم غذایی.')

    last_progress = BodyProgress.objects.filter(member=member).order_by('-recorded_at').first()
    if last_progress:
        lines.append(
            f'آخرین اندازه‌گیری بدن: {last_progress.recorded_at} — وزن {last_progress.weight_kg} کیلوگرم.'
        )

    return '\n'.join(lines)


def _trainer_context(user):
    from accounts.models import TrainerMemberAssignment
    from classes.models import ClassSession

    trainer = user.trainer_profile
    members = TrainerMemberAssignment.objects.filter(
        trainer=trainer, status=TrainerMemberAssignment.Status.ACTIVE
    ).count()
    upcoming = (
        ClassSession.objects.filter(trainer=trainer, session_date__gte=timezone.now().date())
        .order_by('session_date')[:5]
    )
    lines = [
        f'کاربر فعلی: {user.full_name} (نقش: مربی).',
        f'تعداد اعضای فعال تحت مربی‌گری: {members} نفر.',
    ]
    if upcoming:
        items = ', '.join(f'{s.gym_class.name} در {s.session_date}' for s in upcoming)
        lines.append(f'جلسات پیش رو: {items}.')
    return '\n'.join(lines)


def _admin_context(user):
    from memberships.models import Subscription

    active = Subscription.objects.filter(status=Subscription.Status.ACTIVE).count()
    total = Subscription.objects.count()
    return (
        f'کاربر فعلی: {user.full_name} (نقش: مدیر باشگاه).\n'
        f'اشتراک‌های فعال: {active} از مجموع {total} اشتراک ثبت‌شده.'
    )


def _build_system_prompt(user):
    base = (
        'تو «یار تناسب» هستی، دستیار هوشمند باشگاه Tanasob. '
        'همیشه به فارسی، دوستانه، کوتاه و کاربردی پاسخ بده. '
        'اگر داده‌ای در اطلاعات زیر نبود، حدس نزن و صادقانه بگو که اطلاعش را نداری. '
        'در حوزه‌ی تمرین، تغذیه و مدیریت باشگاه راهنمایی کن؛ برای تشخیص پزشکی کاربر را به یک متخصص ارجاع بده. '
        'پاسخ‌ها را به‌صورت متن ساده بنویس: بدون جدول Markdown، بدون تیتر با #، بدون **. '
        'اگر لازم بود چند مورد را فهرست کنی، هرکدام را در یک خط جدید با یک خط تیره (-) بیاور.\n\n'
    )
    if user.is_member:
        context = _member_context(user)
    elif user.is_trainer:
        context = _trainer_context(user)
    else:
        context = _admin_context(user)
    return base + context


def _call_gateway(messages, model=None):
    api_base = settings.AI_LLM_API_BASE
    api_key = settings.AI_LLM_API_KEY
    if not api_base or not api_key:
        raise AssistantError('سرویس هوش مصنوعی هنوز پیکربندی نشده است.')

    # The ArvanCloud gateway occasionally resets the connection under load;
    # one silent retry clears most of those without surfacing an error.
    response = None
    last_error = None
    for attempt in range(2):
        try:
            response = requests.post(
                f'{api_base.rstrip("/")}/chat/completions',
                headers={
                    'Authorization': f'{settings.AI_LLM_AUTH_SCHEME} {api_key}',
                    'Content-Type': 'application/json',
                },
                json={'model': model or settings.AI_LLM_MODEL, 'messages': messages},
                timeout=settings.AI_LLM_TIMEOUT,
            )
            break
        except requests.exceptions.RequestException as exc:
            last_error = exc
    if response is None:
        raise AssistantError('اتصال به سرویس هوش مصنوعی برقرار نشد. لطفاً دوباره امتحان کن.') from last_error

    if response.status_code != 200:
        raise AssistantError(f'سرویس هوش مصنوعی خطا داد ({response.status_code}).')

    data = response.json()
    try:
        return data['choices'][0]['message']['content'] or ''
    except (KeyError, IndexError):
        raise AssistantError('پاسخ نامعتبر از سرویس هوش مصنوعی دریافت شد.')



def ask_assistant(user, user_text):
    """Store the user's message, call the LLM with recent history, store and
    return the assistant's reply."""

    ChatMessage.objects.create(user=user, role=ChatMessage.Role.USER, content=user_text)

    recent = list(
        ChatMessage.objects.filter(user=user).order_by('-created_at')[:HISTORY_LIMIT]
    )[::-1]

    messages = [{'role': 'system', 'content': _build_system_prompt(user)}]
    messages += [
        {'role': 'user' if m.role == ChatMessage.Role.USER else 'assistant', 'content': m.content}
        for m in recent
    ]

    reply_text = _call_gateway(messages)
    reply = ChatMessage.objects.create(user=user, role=ChatMessage.Role.ASSISTANT, content=reply_text)
    return reply
