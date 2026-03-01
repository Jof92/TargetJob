// utils/pdfParser.ts
export async function extrairTextoDoPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);

    if (!data?.text) {
      throw new Error('PDF não retornou texto');
    }

    return data.text
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error: any) {
    console.error('❌ Erro pdf-parse:', error?.message);
    throw new Error('Não foi possível ler o PDF. Verifique se o arquivo está válido.');
  }
}

export function validarPDF(buffer: Buffer): { valido: boolean; erro?: string } {
  if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
    return { valido: false, erro: 'Arquivo não é um PDF válido' };
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { valido: false, erro: 'PDF muito grande. Máximo: 10MB' };
  }

  return { valido: true };
}