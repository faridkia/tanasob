"""
Server-side sanitisation for rich-text fields written in the admin/trainer
WYSIWYG editor.

Why this exists: those fields are stored as HTML and rendered back into the
page with React's `dangerouslySetInnerHTML`. Anything the browser would
execute has to be stripped BEFORE it is saved, and it has to happen here
rather than in the editor — a client-side editor is a convenience, not a
security boundary, and the API accepts requests that never went near it.

The allowlist is deliberately small: formatting, links, lists, tables and
images. No <script>, no <style>, no event handlers, no inline styles, and
no javascript:/data: URLs.
"""

import bleach

ALLOWED_TAGS = [
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
    # CKEditor tags block/figure elements with its own classes (image
    # alignment, table styling); keeping `class` preserves that layout
    # without letting anything execute.
    '*': ['class'],
}

# Relative URLs (our own /media/… uploads) are always allowed by bleach;
# this list constrains the absolute ones. `data:` is excluded on purpose —
# it allows both huge inline payloads and some XSS vectors.
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']

MAX_HTML_LENGTH = 200_000


def sanitize_html(value: str) -> str:
    """Strip anything executable from editor HTML. Safe to call on None."""
    if not value:
        return ''
    return bleach.clean(
        value[:MAX_HTML_LENGTH],
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )


class SanitizedHTMLField:
    """Mixin helper for serializers: run one HTML field through the cleaner.

    Used as ``validate_<field>`` so it runs on every write, including PATCH
    and anything posted directly at the API.
    """

    @staticmethod
    def clean(value):
        return sanitize_html(value)
