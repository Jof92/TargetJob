// app/api/upload-pdf/route.ts
import { NextResponse } from 'next/server';
import { extrairTextoDoPDF, validarPDF } from '@/utils/pdfParser';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('📁 Arquivo recebido:', file?.name, file?.type, file?.size);

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Apenas arquivos PDF são permitidos' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('📦 Buffer criado, tamanho:', buffer.length);
    console.log('🔍 Primeiros bytes:', buffer.toString('ascii', 0, 4));

    const validacao = validarPDF(buffer);
    console.log('✅ Validação:', validacao);

    if (!validacao.valido) {
      return NextResponse.json({ error: validacao.erro }, { status: 400 });
    }

    console.log('🔄 Iniciando extração de texto...');
    const textoCV = await extrairTextoDoPDF(buffer);
    console.log('📝 Texto extraído, tamanho:', textoCV.length);

    if (!textoCV.trim()) {
      return NextResponse.json({ error: 'PDF vazio ou não contém texto legível' }, { status: 400 });
    }

    return NextResponse.json({
      textoCV,
      nomeArquivo: file.name,
      tamanho: buffer.length
    });

  } catch (error: any) {
    console.error('💥 ERRO COMPLETO NO UPLOAD:', error);
    console.error('💥 Stack:', error?.stack);
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar PDF' },
      { status: 500 }
    );
  }
}