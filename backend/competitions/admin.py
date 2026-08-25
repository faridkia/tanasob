from django.contrib import admin

from .models import Competition, CompetitionParticipant, CompetitionPrize


class CompetitionPrizeInline(admin.TabularInline):
    model = CompetitionPrize
    extra = 1


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'organization', 'kind', 'level', 'start_date', 'end_date', 'is_active')
    list_filter = ('organization', 'kind', 'level', 'is_active')
    inlines = [CompetitionPrizeInline]


@admin.register(CompetitionParticipant)
class CompetitionParticipantAdmin(admin.ModelAdmin):
    list_display = ('competition', 'member', 'joined_at')
