// import pdf from 'pdf-parse';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdf = (await import('pdf-parse')).default;
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error("Error loading pdf-parse:", error);
    return "";
  }
}
