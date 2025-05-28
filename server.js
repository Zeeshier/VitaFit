const express = require('express');
const cors = require('cors');
const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const apiKey = process.env.GROK_API_KEY; 
// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Initialize Groq model
const llm = new ChatGroq({
    model: 'deepseek-r1-distill-llama-70b',
    apiKey: apiKey
});

// Define Prompt Template
const promptTemplate = ChatPromptTemplate.fromTemplate(`
You're a certified personal trainer.

Create a personalized {days}-day workout plan for a user based on:
- Fitness level: {fitness_level}
- Goals: {goals}
- Available equipment: {equipment}
- Daily session duration: {duration} minutes
- Focus areas: {focus_areas}

Return **only** a JSON object in the exact format shown below. Do not include any additional text, explanations, markdown, tags (e.g., <think>), or metadata outside the JSON object. Do not include code fences (e.g., \`\`\`json). Ensure the JSON is properly formatted and includes all required fields.

**Expected JSON Format:**
{{
  "days": [
    {{
      "day": 1,
      "focus": "Chest and Triceps",
      "warmup": ["5 min light cardio", "Dynamic stretches"],
      "exercises": [
        {{"name": "Bench Press", "details": "3 sets of 10 reps"}},
        {{"name": "Tricep Dips", "details": "3 sets of 12 reps"}}
      ],
      "cooldown": ["Static stretching"]
    }}
  ]
}}

- The "days" array must contain exactly {days} entries.
- Each day must have "day" (integer), "focus" (string), "warmup" (array of strings), "exercises" (array of objects with "name" and "details"), and "cooldown" (array of strings).
- Do not include any additional fields, text, or tags.
`);

// Chain the prompt with the model and output parser
const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());

// API Endpoint to generate the plan and save to file
app.post('/generate-plan', async (req, res) => {
    try {
        const { fitness_level, goals, equipment, days, duration, focus_areas } = req.body;

        // Validate input
        if (!fitness_level || !goals || !equipment || !days || !duration || !focus_areas) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate the workout plan using the model
        const response = await chain.invoke({
            fitness_level,
            goals: goals.join(', '),
            equipment: equipment.join(', '),
            days,
            duration,
            focus_areas: focus_areas.join(', ')
        });

        // Log the raw response for debugging
        console.log('Raw model response:', response);

        // Post-process the response to extract the JSON object
        let jsonString = response;
        try {
            // Find the first occurrence of '{' to start of JSON
            const jsonStart = jsonString.indexOf('{');
            if (jsonStart === -1) {
                throw new Error('No JSON object found in response');
            }

            // Find the last occurrence of '}' to end of JSON
            const jsonEnd = jsonString.lastIndexOf('}');
            if (jsonEnd === -1) {
                throw new Error('Incomplete JSON object in response');
            }

            // Extract the JSON portion
            jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

            // Parse the extracted JSON
            const workoutPlan = JSON.parse(jsonString);

            if (!workoutPlan.days || !Array.isArray(workoutPlan.days)) {
                throw new Error('Parsed response does not contain a valid days array');
            }
            if (workoutPlan.days.length !== days) {
                throw new Error(`Expected ${days} days, but got ${workoutPlan.days.length}`);
            }

            // Validate the structure of each day
            workoutPlan.days.forEach(day => {
                if (!day.day || !day.focus || !Array.isArray(day.warmup) || !Array.isArray(day.exercises) || !Array.isArray(day.cooldown)) {
                    throw new Error('Invalid day structure: missing required fields');
                }
                if (typeof day.day !== 'number' || !Number.isInteger(day.day)) {
                    throw new Error('Day must be an integer');
                }
                if (typeof day.focus !== 'string') {
                    throw new Error('Focus must be a string');
                }
                if (!day.warmup.every(item => typeof item === 'string')) {
                    throw new Error('Warmup must be an array of strings');
                }
                if (!day.cooldown.every(item => typeof item === 'string')) {
                    throw new Error('Cooldown must be an array of strings');
                }
                day.exercises.forEach(ex => {
                    if (!ex.name || !ex.details) {
                        throw new Error('Invalid exercise structure: missing name or details');
                    }
                    if (typeof ex.name !== 'string' || typeof ex.details !== 'string') {
                        throw new Error('Exercise name and details must be strings');
                    }
                });
            });

            // Save the workout plan to a JSON file
            try {
                await fs.writeFile('workout-plan.json', JSON.stringify(workoutPlan, null, 2));
                console.log('Workout plan saved to workout-plan.json');
            } catch (fileError) {
                console.error('Error saving workout plan to file:', fileError);
                return res.status(500).json({ error: 'Failed to save workout plan to file' });
            }

            res.json(workoutPlan);
        } catch (parseError) {
            console.error('Failed to parse model response as JSON:', parseError);
            return res.status(500).json({ error: 'Model response is not valid JSON' });
        }
    } catch (error) {
        console.error('Error generating workout plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to serve the saved workout plan
app.get('/get-plan', async (req, res) => {
    try {
        const data = await fs.readFile('workout-plan.json', 'utf8');
        const workoutPlan = JSON.parse(data);
        res.json(workoutPlan);
    } catch (error) {
        console.error('Error reading workout plan from file:', error);
        res.status(500).json({ error: 'Failed to read workout plan from file' });
    }
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});