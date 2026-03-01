// lib/groq.ts
import OpenAI from 'openai';

export const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://matchcv.app', // Opcional: ajuda com limites
    'X-Title': 'MatchCV SaaS'
  }
});

export const MODEL = 'llama-3.1-70b-versatile';