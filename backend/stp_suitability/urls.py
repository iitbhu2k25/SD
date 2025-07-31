from django.urls import path
from . import views

from .attributes import GetMultipleFileAttributesView  # Import directly from attributes.py

urlpatterns = [
    path('conditioning-factors/', views.get_conditioning_factors, name='get_conditioning_factors'),
    path('constraints-factors/', views.get_constraints_factors, name='get_constraints_factors'),
    path('process-selected-files/', views.process_selected_files, name='process-selected_files'),
    path('stp-files/<str:file_id>/details/', views.get_file_details, name='stp_file_details'),
    # path('get-multiple-attributes/', GetMultipleAttributesView.as_view(), name='get_multiple_attributes'),
    path('get-multiple-attributes/', GetMultipleFileAttributesView.as_view(), name='get-multiple-file-attributes'),
    
]

