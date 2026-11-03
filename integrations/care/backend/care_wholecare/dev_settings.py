"""External settings for this isolated synthetic development stack only."""
import json
import os
from config.settings.local import *  # noqa: F403,F401
CORS_ORIGIN_ALLOW_ALL = False
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = json.loads(os.environ["WHOLECARE_BROWSER_ORIGINS"])
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
