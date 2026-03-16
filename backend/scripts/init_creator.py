from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.bootstrap import init_db, seed_creator, seed_system_data


if __name__ == "__main__":
    settings = get_settings()
    init_db()
    with SessionLocal() as db:
        seed_system_data(db)
        seed_creator(db, settings.first_creator_login, settings.first_creator_password, settings.first_creator_full_name)
    print("Creator ensured")
