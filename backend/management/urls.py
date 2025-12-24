# backend/management/urls.py
from django.urls import path
from .views import RegisterAdminView, LoginAdminView, LogoutAdminView, PersonalAdminListView, RegisterEmployeeView, LoginEmployeeView, LogoutEmployeeView, EmployeeStatusView, FilterEmployeesByProjectView
from .leave_views import ApplyLeaveAPIView, LeaveApprovalAPIView, LeaveByEmployeeEmailView, UpdateLeaveApprovalStatusView, UpdateLeaveApprovalStatusWebView, LeaveByEmployeeEmailGetView
urlpatterns = [
    path('register', RegisterAdminView.as_view()),
    path('login', LoginAdminView.as_view(), name="admin-login"),
    path('logout', LogoutAdminView.as_view(), name="admin-logout"),
    path('admindata', PersonalAdminListView.as_view(), name="admin-list"),
    path('register/employee', RegisterEmployeeView.as_view(), name='register_employee'),
    path('login/employee', LoginEmployeeView.as_view(), name='login_employee'),
    path('logout/employee', LogoutEmployeeView.as_view(), name='logout_employee'),
    path('status/employee', EmployeeStatusView.as_view(), name='employee_status'),
    path('filter-employees', FilterEmployeesByProjectView.as_view(), name='employee_list'),
    path('apply-leave', ApplyLeaveAPIView.as_view()),
    path('leave-update-status',UpdateLeaveApprovalStatusView.as_view(),name='update_leave_status'),
    path('leave-update-status-web',UpdateLeaveApprovalStatusWebView.as_view(),name='update_leave_status_web'),
    path('leave-employee-email', LeaveByEmployeeEmailView.as_view(), name='leave_by_employee_email'),
    path('leave-employee-email-get/<path:email>', LeaveByEmployeeEmailGetView.as_view())

]
