"""Run through CARE manage.py shell after its development fixtures load once.

Uses existing seed doctor/facility and standard role; never creates credentials or
broadens permissions on any non-fixture user/patient.
"""
import json
from care.users.models import User
from care.facility.models import Facility
from care.emr.models import Patient, Encounter, PatientUser
from care.security.models import RoleModel
from care.security.authorization import AuthorizationController
from django.utils import timezone

user = User.objects.get(username='care-doctor')
facility = Facility.objects.get(name='FACILITY WITH PATIENTS')
role = RoleModel.objects.get(name='Doctor', deleted=False)
patient, created = Patient.objects.get_or_create(
    external_id='8bb02ec2-6b42-47d9-8ed3-700bf92a1060',
    defaults={'name':'WholeCare synthetic patient','gender':'female','year_of_birth':1980,'blood_group':'unknown','geo_organization':facility.geo_organization,'meta':{'wholecare_synthetic':True}},
)
if patient.meta.get('wholecare_synthetic') is not True:
    raise ValueError('Existing patient is not the dedicated synthetic fixture.')
PatientUser.objects.get_or_create(user=user,patient=patient,defaults={'role':role})
encounter,_ = Encounter.objects.get_or_create(patient=patient,facility=facility,defaults={'status':'in_progress','encounter_class':'amb','period':{'start':timezone.now().isoformat()}})
assert AuthorizationController.call('can_view_patient_obj',user,patient)
assert AuthorizationController.call('can_view_clinical_data',user,patient)
print('WHOLECARE_CONTEXT='+json.dumps({'care_user_id':str(user.external_id),'care_patient_id':str(patient.external_id),'care_facility_id':str(facility.external_id),'care_encounter_id':str(encounter.external_id)}))
