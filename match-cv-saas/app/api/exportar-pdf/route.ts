// app/api/exportar-pdf/route.ts
import { NextResponse } from 'next/server';
import { gerarPDFOtimizado, type CVData } from '@/utils/pdfGenerator';

export async function POST(request: Request) {
  try {
    const { cvData } = await request.json();

    if (!cvData?.nome || !Array.isArray(cvData.experiencias)) {
      return NextResponse.json({ error: 'Dados do CV inválidos' }, { status: 400 });
    }

    // Garantir arrays
    cvData.habilidades = cvData.habilidades || [];
    cvData.educacao = cvData.educacao || [];
    cvData.idiomas = Array.isArray(cvData.idiomas) ? cvData.idiomas : [];

    // Normalizar bullet points
    cvData.experiencias = cvData.experiencias.map((exp: any) => ({
      ...exp,
      descricao: String(exp.descricao || '')
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    }));

    const pdfBuffer = await gerarPDFOtimizado(cvData as CVData);
    const base64PDF = pdfBuffer.toString('base64');

    console.log('✅ PDF exportado para:', cvData.nome);

    return NextResponse.json({ pdfBase64: base64PDF });

  } catch (error: any) {
    console.error('💥 Erro ao exportar PDF:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao exportar PDF' },
      { status: 500 }
    );
  }
}