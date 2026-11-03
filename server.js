const express = require("express");
const app = express();
app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const SYSTEM_PROMPT = `You are a master 3D Roblox builder. Output ONLY a raw JSON object matching the schema.
{"name": "string", "parts": [{"shape": "Block|Wedge|Cylinder|Ball", "size": [x, y, z], "offset": [x, y, z], "color": [r, g, b], "material": "Plastic|Wood|Brick|Concrete|Metal|Neon|Glass", "rotation": [x, y, z]}]}

CRITICAL RULES FOR HIGH QUALITY:
1. Use between 120 and 180 parts. Do not use fewer than 120 parts. We want extreme detail.
2. To make curves (like a car hood or roof), use many small overlapping blocks and wedges.
3. To make wheels, you MUST use "Cylinder" shape and set rotation to [0, 0, 90] so they are horizontal.
4. A Roblox character is 5 studs tall. Cars must be 16-20 studs long, 8 studs wide, and 6 studs tall.
5. Use "Glass" for windshields, "Neon" for headlights, "Metal" for the chassis, and "Plastic" for the body.
6. Ensure every part intersects with another part. Do not leave gaps.`;

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
                temperature: 0.5, 
                max_tokens: 8192, // Pushed to the absolute max to fit 150 parts
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
        console.log("AI is building a high-detail model (this will take 60-90 seconds)...");
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
