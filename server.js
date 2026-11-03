const express = require("express");
const app = express();
app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const SYSTEM_PROMPT = `You are an expert 3D Roblox builder. Output ONLY a raw JSON object matching the schema.
{"name": "string", "parts": [{"shape": "Block|Wedge|Cylinder|Ball", "size": [x, y, z], "offset": [x, y, z], "color": [r, g, b], "material": "Plastic|Wood|Brick|Concrete|Metal|Neon|Glass", "rotation": [x, y, z]}]}

RULES:
1. Max 45 parts. Use as many as needed for high detail.
2. Sizes 0.5-40. Colors 0-255. 
3. Offset Y is up, lowest part at Y=0. 
4. Center the build on the X and Z axes.
5. A Roblox character is 5 studs tall. Cars must be at least 12-16 studs long and 6-8 studs wide.
6. To make a wheel, use a "Cylinder" shape, and set its rotation to [0, 0, 90] so it rolls sideways.
7. For a car: Create a detailed chassis, a cabin, glass windows, metal bumpers, neon headlights, and 4 distinct wheels. Make it look aerodynamic.
8. Ensure parts overlap slightly so there are no floating gaps.`;

async function callNvidia(prompt) {
    const controller = new AbortController();
    // Increased timeout to 115 seconds
    const timeoutId = setTimeout(() => controller.abort(), 115000); 

    try {
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${NVIDIA_API_KEY}`
            },
            body: JSON.stringify({
                // Switched back to MiniMax for 3D spatial reasoning
                model: "minimaxai/minimax-m3.1-flash", 
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                temperature: 0.4, 
                max_tokens: 4000,
                response_format: { type: "json_object" }, 
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`NVIDIA API Error ${response.status}: ${errText}`);
        }

        const json = await response.json();
        let content = json.choices?.[0]?.message?.content || "";
        
        content = content.replace(/```json|```/g, "").trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error("AI did not return a JSON object.");

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

app.post('/build', async (req, res) => {
    console.log("--- NEW REQUEST FROM ROBLOX ---");
    try {
        console.log("AI is building... (this may take up to 60 seconds)");
        const buildSpec = await callNvidia(req.body.prompt);
        console.log("Success! Valid JSON sent to Roblox.");
        return res.json(buildSpec);
    } catch (error) {
        console.error("PROXY ERROR:", error.message || error);
        return res.status(500).json({ error: "Failed." });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running and waiting for Roblox...");
});
