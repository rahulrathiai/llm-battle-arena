from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from datetime import datetime

Base = declarative_base()

engine = create_async_engine(
    "sqlite+aiosqlite:///./battles.db",
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Battle(Base):
    __tablename__ = "battles"
    
    id = Column(Integer, primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    responses = relationship("Response", back_populates="battle", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="battle", cascade="all, delete-orphan")


class Response(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("battles.id"), nullable=False)
    model_name = Column(String, nullable=False)
    response_text = Column(Text, nullable=False)
    average_score = Column(Float, nullable=True)
    is_winner = Column(Integer, default=0)  # 0 or 1
    
    battle = relationship("Battle", back_populates="responses")
    ratings = relationship("Rating", back_populates="response", cascade="all, delete-orphan")


class Rating(Base):
    __tablename__ = "ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("battles.id"), nullable=False)
    response_id = Column(Integer, ForeignKey("responses.id"), nullable=False)
    judge_model = Column(String, nullable=False)  # Which model did the rating
    score = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=True)
    
    battle = relationship("Battle", back_populates="ratings")
    response = relationship("Response", back_populates="ratings")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

