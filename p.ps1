Set-Location "E:\slcrdeployment_new"

# Write-Host "Step 1: Stop docker compose and remove volumes"
# docker compose down

# Write-Host "Step 2: Start docker compose in this terminal"
# Write-Host "Step 3: After docker starts, open a new VS Code terminal and run the remaining commands there"
# docker compose up -d


Write-Host "Step 4: Run fast_backend migration and geoserver_vector.py"
docker compose exec fast_backend bash -lc "alembic upgrade head"
# cd script && python geoserver_vector.py

Write-Host "Step 5: Run fast_m migration"
docker compose exec fast_m bash -lc "alembic revision --autogenerate -m 'fast_m migration' &&  alembic upgrade head"

Write-Host "Step 6: Run media run.py"
Set-Location "D:\Deploy_Phase_2\slcrdeployment\fast_m\media"
python run.py

Write-Host "Step 5: Run push_to_geoserver.py"
docker compose exec fast_m bash -lc "cd script && python push_to_geoserver.py"


# Write-Host "Step 7: All steps completed"
# docker compose logs -f
