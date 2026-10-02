import dotenv from "dotenv";
import { ChatGoogle } from "@langchain/google";
import { ChatOpenAI } from "@langchain/openai";

dotenv.config();

export const model2 = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-5-mini",
});

export const model = new ChatGoogle({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-3.5-flash-lite",
});