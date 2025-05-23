import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY")

llm = ChatGroq(model="llama3-8b-8192", temperature=0, groq_api_key=GROQ_API_KEY)    

# Define Prompt Template
prompt_template = PromptTemplate.from_template("""
You're a certified personal trainer.

Create a personalized {days}-day workout plan for a user based on:
- Fitness level: {fitness_level}
- Goals: {goals}
- Available equipment: {equipment}
- Daily session duration: {duration} minutes
- Focus areas: {focus_areas}

Provide each day's workout breakdown including warm-up, main session (with sets and reps), cardio/HIIT if applicable, and cool-down. Keep it motivational and structured.
""")

chain = prompt_template | llm | StrOutputParser()

class FitnessForm(BaseModel):
    fitness_level: str
    goals: list[str]
    equipment: list[str]
    days: int
    duration: int
    focus_areas: list[str]

@app.post("/generate-plan")
async def generate_plan(form: FitnessForm):
    try:
        response = chain.invoke({
            "fitness_level": form.fitness_level,
            "goals": ', '.join(form.goals),
            "equipment": ', '.join(form.equipment),
            "days": form.days,
            "duration": form.duration,
            "focus_areas": ', '.join(form.focus_areas),
        })
        return {"workout_plan": response}
    except Exception as e:
        return {"error": str(e)}
