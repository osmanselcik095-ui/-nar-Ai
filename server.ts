import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client to prevent startup failure if key is missing.
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is missing. Please add your Gemini API Key in 'Settings > Secrets' on the AI Studio UI.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// System Instruction for Çınar AI
const SYSTEM_INSTRUCTION = `Sen Çınar AI'sın. Adını derin kökleri, bilgeliği, gücü ve huzuru simgeleyen görkemli Çınar ağacından alan, cana yakın, bilgili ve son derece yardımsever bir yapay zekâ sırdaşı ve kişisel rehbersin.

Görüşme Kuralları:
1. Türkçe dilini kusursuz, samimi, saygılı ve içten bir ses tonuyla kullan. İhtiyaç halinde diğer dillerde de kusursuzca yanıt ver.
2. Geniş bir bilgi birikimine sahipsin; tarih, teknoloji, motivasyon, kod yazma, felsefe, sanat ve günlük yaşam tavsiyeleri konusunda rehberlik et.
3. Soruları her zaman motive edici, destekleyici ve eğitici bir dille açıkla. Adım adım yönlendirmeler, üretken fikirler ve pratik çözümler sun.
4. Robotik ve soğuk ifadelerden kaçın. Empati kur, heyecan verici ve canlandırıcı ol.
5. Görüşmelerinde dürüst, yapıcı ve her zaman kullanıcının kişisel gelişimini destekleyen bir bilge gibi davran.`;

// 1. CHAT API ENDPOINT
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mesaj alanı boş olamaz." });
  }

  try {
    const ai = getAI();

    // Map history to the correct Gemini SDK format
    const formattedContents = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        formattedContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      });
    }

    // Add current user prompt
    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Generate output with both the message reply and smart follow-up suggestions in JSON format
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Çınar AI olarak Türkçe dilinde vereceğin, markdown formatında yazılmış, nazik, bilgi dolu ve samimi yanıt.",
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "Kullanıcının bu yanıta dayanarak sorabileceği, her biri en fazla 5-6 kelimeden oluşan, son derece alakalı 3 Türkçe takip önerisi/sorusu.",
            },
          },
          required: ["reply", "suggestions"],
        },
      },
    });

    const rootText = response.text ? response.text.trim() : "";
    if (!rootText) {
      throw new Error("Yapay zekâdan boş yanıt döndü.");
    }

    const parsed = JSON.parse(rootText);
    return res.json({
      reply: parsed.reply,
      suggestions: parsed.suggestions || [],
    });
  } catch (error: any) {
    console.error("Gemini API Error in /api/chat:", error);
    return res.status(error.message?.includes("GEMINI_API_KEY") ? 403 : 500).json({
      error: error.message || "Yapay zekâ yanıtı oluşturulurken bir hata oluştu.",
    });
  }
});

// 2. TEXT-TO-SPEECH VOICE API ENDPOINT
app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Seslendirilecek metin belirtilmedi." });
  }

  try {
    const ai = getAI();

    // Generate cheerful narration in Turkish using Kore voice
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say with a warm, friendly and calm voice in Turkish: ${text.slice(0, 300)}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = inlineData?.data;
    const mimeType = inlineData?.mimeType || "audio/aac";

    if (!base64Audio) {
      throw new Error("Ses verisi üretilemedi.");
    }

    return res.json({ audio: base64Audio, mimeType });
  } catch (error: any) {
    console.error("Gemini API Error in /api/tts:", error);
    return res.status(error.message?.includes("GEMINI_API_KEY") ? 403 : 500).json({
      error: error.message || "Ses üretilirken sistemsel bir hata oluşt.",
    });
  }
});

async function startServer() {
  // Vite dev server mounting or serving static built bundle
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Çınar AI server has started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
