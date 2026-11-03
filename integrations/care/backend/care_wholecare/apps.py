from django.apps import AppConfig

PLUGIN_NAME = "care_wholecare"


class CareWholecareConfig(AppConfig):
    name = PLUGIN_NAME
    verbose_name = "WholeCare Diabetes"

    def ready(self):
        from care_wholecare import signals  # noqa: F401
