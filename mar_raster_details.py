import pandas as pd
from sqlalchemy import create_engine
import os 
from datetime import datetime
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_USER = 'admin'
DB_PASSWORD = 'admin'
DB_HOST = 'localhost'
DB_PORT = '5450'
DB_NAME = 'slcr_cloud'

# Table name and CSV file
TABLE_NAME = 'mar_raster_details'
CSV_FILE = os.path.join(base_dir, "csv_file_stp", "mar_raster_details.csv")

# Create the database engine
engine = create_engine(f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}')

def load_csv_to_db():
    try:
        # Read the CSV file
        df = pd.read_csv(CSV_FILE)
        with engine.connect() as connection:
            # Add timestamps for created_at and modified_at
            now = datetime.now()
            df['created_at'] = now
            df['modified_at'] = now
            
            # Store data in the database using df.to_sql as requested
            df.to_sql(TABLE_NAME, engine, if_exists='append', index=False)
    
    except Exception as e:
        print("An error occurred:", e)

if __name__ == "__main__":
    load_csv_to_db()
