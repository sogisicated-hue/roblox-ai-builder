const express = require("express");
const app = express();
app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const SYSTEM_PROMPT = `You are an expert Roblox builder. Output ONLY a raw JSON object.
{"name": "string", "parts": [{"shape": "Block|Wedge|Cylinder|Ball", "size": [x, y, z], "offset": [x, y, z], "color": [r, g, b], "material": "Plastic|Wood|Brick|Concrete|Metal|Neon|Glass", "rotation": [x, y, z]}]}
RULES: 
1. Max 15 parts. Keep it fast!
2. Sizes 0.5-40. Colors 0-255. 
3. Offset Y is up, lowest part at Y=0. 
4. Use Wedges for roofs, Cylinders for wheels. 
5. A Roblox character is 5 studs tall. Cars must be at least 12 studs long. Houses must be 20 studs wide.`;

async function callNvidia(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 115000); 

    try {
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${NVIDIA_API_KEY}`
            },
            body: JSON.stringify({
                // Switched to the FAST coding model
                model: "poolside/laguna-xs-2.1", 
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3, 
                max_tokens: 2000,
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
        const buildSpec = await callNvidia(req.body.prompt);
        console.log("Success! Sending to Roblox.");
        return res.json(buildSpec);
    } catch (error) {
        console.error("PROXY ERROR:", error.message || error);
        return res.status(500).json({ error: "Failed." });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running and waiting for Roblox...");
});
