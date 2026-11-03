const express = require("express");
const app = express();
app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const SYSTEM_PROMPT = `You are an expert Roblox builder. Output ONLY a raw JSON object matching the schema.
{"name": "string", "parts": [{"shape": "Block|Wedge|Cylinder|Ball", "size": [x, y, z], "offset": [x, y, z], "color": [r, g, b], "material": "Plastic|Wood|Brick|Concrete|Metal|Neon|Glass", "rotation": [x, y, z]}]}
RULES: 
1. Max 30 parts. (Keep it concise so you don't get cut off!)
2. Sizes 0.5-40. Colors 0-255. 
3. Offset Y is up, lowest part at Y=0. 
4. Use Wedges for roofs, Cylinders for wheels. Ensure parts intersect slightly. 
5. Center on X and Z axes. 
6. A Roblox character is 5 studs tall. Make your builds large! Cars must be at least 12 studs long. Houses must be at least 20 studs wide.`;

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
                model: "minimaxai/minimax-m3.1-flash", 
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2, 
                max_tokens: 4096, // Max allowed by most endpoints
                response_format: { type: "json_object" }, // FORCES STRICT JSON
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
        
        if (content.trim() === "") {
            throw new Error("NVIDIA returned an empty response.");
        }

        // Clean up any markdown the AI might have slipped in
        content = content.replace(/```json|```/g, "").trim();
        
        // Extract the JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI did not return a JSON object.");
        }

        // Parse it safely
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed;
        } catch (parseError) {
            console.error("JSON PARSE FAILED. The AI sent this:", content);
            throw new Error("The AI's JSON was malformed. Check the logs.");
        }

    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

app.post('/build', async (req, res) => {
    console.log("--- NEW REQUEST FROM ROBLOX ---");
    console.log("Prompt received:", req.body.prompt);

    try {
        console.log("Sending request to NVIDIA (waiting up to 2 mins)...");
        const buildSpec = await callNvidia(req.body.prompt);
        
        console.log("NVIDIA responded! Valid JSON found. Sending to Roblox.");
        return res.json(buildSpec);

    } catch (error) {
        console.error("PROXY ERROR:", error.message || error);
        return res.status(500).json({ error: "Failed to generate build. Check Render logs." });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running and waiting for Roblox...");
});
