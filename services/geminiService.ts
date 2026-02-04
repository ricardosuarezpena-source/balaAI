
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Eres 'balaAI', un asistente de inteligencia artificial de élite. 
Tus respuestas deben ser:
1. Extremadamente precisas y bien estructuradas.
2. Usar Markdown profesional (tablas, listas, negritas).
3. Tener un tono servicial pero sofisticado.
4. Si el usuario te pide crear una imagen o video, enfócate en describir visualmente lo que se generará.`;

export const streamChat = async (
  history: { role: string; parts: string }[],
  onChunk: (text: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const lastMessage = history[history.length - 1].parts;
    const responseStream = await chat.sendMessageStream({ message: lastMessage });

    let fullText = "";
    for await (const chunk of responseStream) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      onChunk(chunkText);
    }
    
    return fullText;
  } catch (error: any) {
    throw new Error(error.message || "Error en la comunicación con balaAI.");
  }
};

export const generateImage = async (prompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Generate a high-quality, detailed image of: ${prompt}` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No se pudo generar la imagen.");
  } catch (error: any) {
    throw new Error(error.message || "Error al generar la imagen.");
  }
};

export const generateVideo = async (prompt: string, onProgress?: (msg: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    if (onProgress) onProgress("Iniciando motor de video Veo 3.1...");
    
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    const progressMessages = [
      "Esculpiendo los fotogramas...",
      "Ajustando la iluminación cinematográfica...",
      "Renderizando texturas en alta definición...",
      "Sincronizando el movimiento...",
      "Finalizando composición visual..."
    ];
    let msgIdx = 0;

    while (!operation.done) {
      if (onProgress) {
        onProgress(progressMessages[msgIdx % progressMessages.length]);
        msgIdx++;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No se recibió el enlace de descarga del video.");

    // Append API key as required by the documentation
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("SELECTION_REQUIRED");
    }
    throw new Error(error.message || "Error al generar el video.");
  }
};
