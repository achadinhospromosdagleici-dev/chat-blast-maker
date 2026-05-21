// Conversão client-side para OGG/Opus mono usando ffmpeg.wasm (single-thread).
// Lazy-load para não pesar no bundle inicial.

let ffmpegPromise: Promise<unknown> | null = null;

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise as Promise<{
    writeFile: (name: string, data: Uint8Array) => Promise<void>;
    exec: (args: string[]) => Promise<number>;
    readFile: (name: string) => Promise<Uint8Array>;
    deleteFile: (name: string) => Promise<void>;
  }>;
}

export async function convertToOggOpus(file: File): Promise<File> {
  const ffmpeg = await getFfmpeg();
  const inputName = `in_${Date.now()}`;
  const outputName = `out_${Date.now()}.ogg`;
  const buf = new Uint8Array(await file.arrayBuffer());
  await ffmpeg.writeFile(inputName, buf);
  // -ac 1 mono, -ar 48000 (Opus nativo), 48k bitrate adequado para voz
  const code = await ffmpeg.exec([
    "-i", inputName,
    "-vn",
    "-ac", "1",
    "-ar", "48000",
    "-c:a", "libopus",
    "-b:a", "48k",
    "-application", "voip",
    outputName,
  ]);
  if (code !== 0) {
    try { await ffmpeg.deleteFile(inputName); } catch {}
    throw new Error("Falha ao converter áudio para OGG/Opus");
  }
  const out = await ffmpeg.readFile(outputName);
  try { await ffmpeg.deleteFile(inputName); } catch {}
  try { await ffmpeg.deleteFile(outputName); } catch {}
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const arrayBuffer = (out as Uint8Array).buffer.slice(
    (out as Uint8Array).byteOffset,
    (out as Uint8Array).byteOffset + (out as Uint8Array).byteLength,
  ) as ArrayBuffer;
  return new File([arrayBuffer], `${baseName}.ogg`, { type: "audio/ogg" });
}
