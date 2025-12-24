# backend/management/serializers.py
from rest_framework import serializers
from .models import PersonalAdmin, PersonalEmployee, LeaveEmployee
from django.contrib.auth.hashers import make_password


class PersonalAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalAdmin
        exclude = ('password',)

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalAdmin
        fields = ['id', 'name', 'email', 'username', 'password', 'department', 'projects']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = PersonalAdmin(**validated_data)
        user.save()  
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    
    


class EmployeeRegisterSerializer(serializers.ModelSerializer):
    # Accept supervisor_email from frontend
    supervisor_email = serializers.EmailField(write_only=True)

    class Meta:
        model = PersonalEmployee
        fields = [
            'id',
            'name',
            'email',
            'username',
            'password',
            'department',
            'supervisor_name',
            'supervisor_email',
            'project_name',
            'joining_date',      # ✅ NEW FIELD
            'position',          # ✅ NEW FIELD
            'resign_date',       # ✅ NEW FIELD (optional)
            'is_active'
        ]

        extra_kwargs = {
            'password': {'write_only': True},
            'is_active': {'read_only': True},
            'supervisor_name': {'read_only': True},
            'resign_date': {'required': False, 'allow_null': True}  # ✅ Optional field
        }

    def create(self, validated_data):
        supervisor_email = validated_data.pop('supervisor_email')

        # Fetch Admin using email (FK)
        try:
            admin = PersonalAdmin.objects.get(email=supervisor_email)
        except PersonalAdmin.DoesNotExist:
            raise serializers.ValidationError("Invalid supervisor email")

        # Auto-fill supervisor name from Admin table
        validated_data['supervisor_name'] = admin.name
        validated_data['supervisor_email'] = admin

        # Hash password
        validated_data['password'] = make_password(validated_data['password'])
        validated_data['is_active'] = True

        employee = PersonalEmployee.objects.create(**validated_data)
        return employee


class EmployeeLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        return value.lower().strip()



class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer for employee data (without password)"""

    projectName = serializers.CharField(source='project_name', read_only=True)
    supervisor_email = serializers.SerializerMethodField()

    class Meta:
        model = PersonalEmployee
        fields = [
            'id',
            'name',
            'email',
            'username',
            'department',
            'supervisor_name',
            'supervisor_email',
            'projectName',
            'joining_date',      # ✅ NEW FIELD
            'position',          # ✅ NEW FIELD
            'resign_date',       # ✅ NEW FIELD
            'is_active'
        ]
        read_only_fields = fields

    def get_supervisor_email(self, obj):
        return obj.supervisor_email.email if obj.supervisor_email else None


class ProjectFilterSerializer(serializers.Serializer):
    """Serializer for filtering employees by projects"""
    projects = serializers.ListField(
        child=serializers.CharField(max_length=200),
        allow_empty=False
    )



class ApplyLeaveSerializer(serializers.Serializer):
    employee_name = serializers.CharField()
    employee_email = serializers.EmailField()
    supervisor_email = serializers.EmailField()
    from_date = serializers.DateField()
    to_date = serializers.DateField()
    total_days = serializers.IntegerField()
    reason = serializers.CharField()
    leave_type = serializers.CharField()



class ApprovalSerializer(serializers.Serializer):
    leave_id = serializers.IntegerField()
    approval_status = serializers.ChoiceField(
        choices=['approved', 'rejected']
    )