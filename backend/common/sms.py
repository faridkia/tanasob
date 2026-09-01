"""Real SMS sending via sms.ir (session reminders, admin broadcast).

Unconfigured by default — every call becomes a logged no-op instead of an
error, so the rest of the app works fine without an SMS account. Set
``SMS_IR_API_KEY``/``SMS_IR_LINE_NUMBER`` in the environment to go live.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.SMS_IR_API_KEY:
        return None
    from sms_ir import SmsIr

    _client = SmsIr(settings.SMS_IR_API_KEY)
    return _client


def send_sms(phone, message):
    """Send a plain-text SMS. Returns True on success, False otherwise —
    never raises, since a failed reminder shouldn't break the caller."""
    client = _get_client()
    if client is None or not settings.SMS_IR_LINE_NUMBER:
        logger.info('SMS not configured — skipping send to %s: %s', phone, message)
        return False
    try:
        response = client.send_sms(phone, message, linenumber=settings.SMS_IR_LINE_NUMBER)
        ok = 200 <= response.status_code < 300
        if not ok:
            logger.warning('sms.ir send failed (%s): %s', response.status_code, response.text[:200])
        return ok
    except Exception:
        logger.exception('sms.ir send raised an exception for %s', phone)
        return False
