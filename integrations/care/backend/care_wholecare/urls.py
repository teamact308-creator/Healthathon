"""URL routes.

Core mounts this module at /api/care_wholecare/ via the PLUGIN_APPS loop in
config/urls.py. Do not repeat that prefix here.

Routes under `otp/` are for the patient portal (OTP-authenticated, phone-number scoped).
Keep them read-mostly. See the care-auth-contexts skill.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from care_wholecare.viewsets.config import ConfigView
from care_wholecare.viewsets.workspace import WorkspaceView, ReviewView

router = DefaultRouter()
# router.register("things", ThingViewSet, basename="wholecare-thing")
# router.register("otp/things", OTPThingViewSet, basename="otp-wholecare-thing")

urlpatterns = [
    *router.urls,
    path("config/", ConfigView.as_view(), name="care_wholecare-config"),
    path("v1/patients/<uuid:patient_id>/workspace", WorkspaceView.as_view(), name="wholecare-workspace"),
    path("v1/patients/<uuid:patient_id>/loops/<uuid:loop_id>/review", ReviewView.as_view(), name="wholecare-review"),
]
