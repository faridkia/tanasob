"""Shared pagination."""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Default page of 20, but callers may ask for more.

    The calendar needs a whole month of sessions at once; with a fixed page
    of 20 it silently rendered only the first page — which, for an admin
    who also sees past sessions, was entirely the wrong month. The cap keeps
    a client from asking for the entire table.
    """

    page_size_query_param = 'page_size'
    max_page_size = 500
