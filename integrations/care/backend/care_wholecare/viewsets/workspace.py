from django.contrib.auth import get_user_model
import logging
from contextlib import contextmanager
from django.http import HttpResponse
from rest_framework.exceptions import APIException
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.authentication import CustomJWTAuthentication
from care.emr.models import Encounter, Patient
from care.security.authorization import AuthorizationController
from care_wholecare.bridge import BridgeError, PROJECT_URL, SupabaseDelegate, load_link
from care_wholecare.session import SessionStore
from care_wholecare.settings import plugin_settings
logger = logging.getLogger(__name__)


class CareStaffAccess(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, get_user_model()) and request.user.is_active and request.auth is not None and request.auth.get("token_type") == "access"


class BridgeView(APIView):
    authentication_classes = [CustomJWTAuthentication]
    permission_classes = [IsAuthenticated, CareStaffAccess]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

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
        link = load_link(plugin_settings.WHOLECARE_LINKS_FILE, request.user.external_id, patient_id, require_session=not plugin_settings.WHOLECARE_SESSION_DIR)
        patient = Patient.objects.filter(external_id=patient_id, deleted=False).first()
        if patient is None or not AuthorizationController.call("can_view_patient_obj", request.user, patient) or not AuthorizationController.call("can_view_clinical_data", request.user, patient):
            raise BridgeError("Mapped resource not available.", 404)
        if not Encounter.objects.filter(patient=patient, facility__external_id=link["care_facility_id"], deleted=False).exists():
            raise BridgeError("Mapped facility context not available.", 404)
        actor_name = request.user.get_full_name() or request.user.username
        return link, actor_name

    def store(self):
        return SessionStore(plugin_settings.WHOLECARE_SESSION_DIR, plugin_settings.WHOLECARE_SESSION_KEY_FILE)

    @contextmanager
    def delegation(self, request, patient_id):
        link, actor = self.scope(request, patient_id)
        if plugin_settings.WHOLECARE_SESSION_DIR:
            with self.store().delegation(link) as delegate:
                yield delegate, actor
        else:
            yield SupabaseDelegate(link), actor


class ConnectionView(BridgeView):
    def get(self, request, patient_id):
        link, _ = self.scope(request, patient_id)
        self.store()
        key = link["publishable_key"]
        # This deployment uses the modern, explicitly publishable project key.
        if not isinstance(key, str) or not key.startswith("sb_publishable_"):
            raise BridgeError("WholeCare sign-in is not configured safely.")
        return Response({"projectUrl": PROJECT_URL, "publishableKey": key})

    def post(self, request, patient_id):
        link, _ = self.scope(request, patient_id)
        if not isinstance(request.data, dict) or set(request.data) != {"refreshToken"}:
            raise BridgeError("A valid WholeCare sign-in is required.", 400)
        self.store().link(link, request.data["refreshToken"])
        return Response({"connected": True})

    def delete(self, request, patient_id):
        # Allow the mapped owner to remove their grant even after their
        # clinical authorization has been withdrawn.
        if not plugin_settings.WHOLECARE_SESSION_DIR:
            raise BridgeError("Account linking is unavailable.")
        link = load_link(plugin_settings.WHOLECARE_LINKS_FILE, request.user.external_id, patient_id, require_session=False)
        return Response({"disconnected": True, "sessionRevoked": self.store().disconnect(link)})


class WorkspaceView(BridgeView):
    def get(self, request, patient_id):
        with self.delegation(request, patient_id) as (delegate, actor):
            return Response(delegate.workspace(patient_id, actor))


class ReviewView(BridgeView):
    def post(self, request, patient_id, loop_id):
        with self.delegation(request, patient_id) as (delegate, actor):
            required = {"eventKey", "expectedVersion", "note"}
            if not isinstance(request.data, dict) or not required <= set(request.data) <= required | {"reportReceipts"}:
                raise BridgeError("A request key, current version and review note are required.", 400)
            return Response(delegate.review(patient_id, loop_id, request.data, actor))


class OriginalReportView(BridgeView):
    def get(self, request, patient_id, loop_id, evidence_id):
        with self.delegation(request, patient_id) as (delegate, _):
            data, mime, receipt = delegate.original(loop_id, evidence_id)
        return HttpResponse(data, content_type=mime, headers={
            "X-WholeCare-Report-Receipt": receipt, "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox", "Referrer-Policy": "no-referrer",
        })
