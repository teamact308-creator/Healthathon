from django.contrib.auth import get_user_model
import logging
from rest_framework.exceptions import APIException
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.authentication import CustomJWTAuthentication
from care.emr.models import Encounter, Patient
from care.security.authorization import AuthorizationController
from care_wholecare.bridge import BridgeError, SupabaseDelegate, load_link
from care_wholecare.settings import plugin_settings
logger = logging.getLogger(__name__)


class CareStaffAccess(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, get_user_model()) and request.user.is_active and request.auth is not None and request.auth.get("token_type") == "access"


class BridgeView(APIView):
    authentication_classes = [CustomJWTAuthentication]
    permission_classes = [IsAuthenticated, CareStaffAccess]

    def handle_exception(self, exc):
        if isinstance(exc, BridgeError):
            return Response({"detail": exc.detail}, status=exc.status)
        if isinstance(exc, APIException):
            return super().handle_exception(exc)
        # A development DEBUG traceback must never disclose the delegated token.
        logger.error("WholeCare bridge failed safely (%s)", type(exc).__name__)
        return Response({"detail": "WholeCare could not confirm the request. Refresh before retrying."}, status=503)

    def scope(self, request, patient_id):
        if not plugin_settings.WHOLECARE_ENABLED:
            raise BridgeError("WholeCare integration is disabled.")
        link = load_link(plugin_settings.WHOLECARE_LINKS_FILE, request.user.external_id, patient_id)
        patient = Patient.objects.filter(external_id=patient_id, deleted=False).first()
        if patient is None or not AuthorizationController.call("can_view_patient_obj", request.user, patient) or not AuthorizationController.call("can_view_clinical_data", request.user, patient):
            raise BridgeError("Mapped resource not available.", 404)
        if not Encounter.objects.filter(patient=patient, facility__external_id=link["care_facility_id"], deleted=False).exists():
            raise BridgeError("Mapped facility context not available.", 404)
        actor_name = request.user.get_full_name() or request.user.username
        return SupabaseDelegate(link), actor_name


class WorkspaceView(BridgeView):
    def get(self, request, patient_id):
        delegate, actor = self.scope(request, patient_id)
        return Response(delegate.workspace(patient_id, actor))


class ReviewView(BridgeView):
    def post(self, request, patient_id, loop_id):
        delegate, actor = self.scope(request, patient_id)
        if not isinstance(request.data, dict) or set(request.data) != {"eventKey", "expectedVersion", "note"}:
            raise BridgeError("A request key, current version and review note are required.", 400)
        return Response(delegate.review(patient_id, loop_id, request.data, actor))
