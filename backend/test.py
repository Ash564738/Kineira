# check_password.py
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.orm import sessionmaker
from db.models import engine, User
from api.services.auth import verify_password

Session = sessionmaker(bind=engine)
db = Session()
user = db.query(User).filter(User.username == "demo_user").first()
print("Verify 'demo123':", verify_password("demo123", user.hashed_password))
db.close()