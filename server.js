const express = require("express");
const OpenAI = require("openai");
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const SYSTEM_PROMPT = `You are an expert Roblox builder. Output ONLY a JSON object matching the schema. Do not include markdown code blocks.
{"name": "string", "parts": [{"shape": "Block|Wedge|Cylinder|Ball", "size": [x, y, z], "offset": [x, y, z], "color": [r, g, b], "material": "Plastic|Wood|Brick|Concrete|Metal|Neon|Glass", "rotation": [x, y, z]}]}
RULES: Max 60 parts. Sizes 0.5-40. Colors 0-255. Offset Y is up, lowest part at Y=0. Use Wedges for roofs, Cylinders for wheels. Ensure parts intersect slightly. Center on X and Z axes.`;

app.post('/build', async (req, res) => {
  // THIS LINE TELLS US ROBLOX CONNECTED
  console.log("--- NEW REQUEST FROM ROBLOX ---");
  console.log("Prompt received:", req.body.prompt);

  try {
    const completion = await openai.chat.completions.create({
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: req.body.prompt }],
      temperature: 0.2,
      max_tokens: 4000,
      chat_template_kwargs: { "enable_thinking": true },
      stream: false
    });
    
    let raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    return res.json(JSON.parse(raw));
    
  } catch (error) {
    // THIS LINE TELLS US IF NVIDIA FAILED
    console.error("NVIDIA ERROR:", error);
    return res.status(500).json({ error: "Failed" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running and waiting for Roblox...");
});
