from django.db import models

class LoginCredential(models.Model):
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)  # 👈 New optional field

    class Meta:
        db_table = 'login_credentials'
