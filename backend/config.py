from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    api_secret_key: str = "secret"
    pool_path: str = "data/manhwa_pool.json"
    rounds_per_game: int = 10
    seconds_per_round: int = 20
    points_exact: int = 100
    points_fuzzy: int = 50
    max_players_per_room: int = 8
    suggestions_enabled_default: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
