// app/api/gerar-carta/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';

export async function POST(request: Request) {
  try {
    const { cvData, vaga, idiomaVaga, cartaPersonalizada } = await request.json();

    if (!cvData || !vaga?.trim()) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Se veio carta personalizada, só gera o PDF dela
    if (cartaPersonalizada) {
      const pdfBase64 = await gerarCartaPDF(cvData.nome, cvData.contato, cartaPersonalizada);
      return NextResponse.json({ carta: cartaPersonalizada, assunto: '', pdfBase64 });
    }

    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    const idioma = idiomaVaga || 'pt';
    const instrucaoIdioma =
      idioma === 'en' ? 'Write the cover letter entirely in ENGLISH.' :
      idioma === 'es' ? 'Escribe la carta completamente en ESPAÑOL.' :
      idioma === 'fr' ? 'Rédigez la lettre entièrement en FRANÇAIS.' :
      'Escreva a carta inteiramente em PORTUGUÊS BRASILEIRO.';

    const prompt = `
You are a senior career coach and expert writer.
Write a compelling, highly personalized cover letter.

LANGUAGE: ${instrucaoIdioma}

CANDIDATE:
Name: ${cvData.nome}
Summary: ${cvData.resumo}
Experience: ${cvData.experiencias?.map((e: any) => `${e.cargo} at ${e.empresa} (${e.periodo})`).join('; ')}
Skills: ${cvData.habilidades?.join(', ')}

TARGET JOB:
${vaga.substring(0, 3000)}

COVER LETTER RULES:
1. ${instrucaoIdioma}
2. Exactly 4 paragraphs, professional and direct tone
3. Paragraph 1: Strong opening hook — mention company and role BY NAME, show you know the business
4. Paragraph 2: Most relevant experience that directly matches the job (specific, no fake metrics)
5. Paragraph 3: Unique value — what the candidate brings that others don't
6. Paragraph 4: Confident closing with call to action
7. FORBIDDEN: "I am writing to express my interest", "dedicated professional", generic phrases
8. Under 350 words total
9. Sign with candidate's name

RETURN ONLY JSON:
{
  "carta": "Full letter text with \\n for line breaks between paragraphs",
  "assunto": "Suggested email subject line"
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an expert cover letter writer. ${instrucaoIdioma}
Write compelling, specific, non-generic letters. NEVER start with "I am writing to express my interest".
Return ONLY valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    let parsed: any;
    try {
      parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      throw new Error('AI returned invalid JSON.');
    }

    if (!parsed.carta) throw new Error('Cover letter content missing.');

    const cartaTexto = String(parsed.carta).replace(/\\n/g, '\n').trim();
    const pdfBase64 = await gerarCartaPDF(cvData.nome, cvData.contato, cartaTexto);

    return NextResponse.json({
      carta: cartaTexto,
      assunto: parsed.assunto || '',
      pdfBase64,
    });

  } catch (error: any) {
    console.error('💥 Erro ao gerar carta:', error?.message);
    return NextResponse.json({ error: error?.message || 'Erro ao gerar carta' }, { status: 500 });
  }
}

async function gerarCartaPDF(nome: string, contato: string, carta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 65 });
      const buffers: Buffer[] = [];
      doc.on('data', (c) => buffers.push(c));
      doc.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
      doc.on('error', reject);

      const mx = 65;
      const larg = doc.page.width - mx * 2;

      // Header
      doc.fillColor('#2563eb').fontSize(17).font('Helvetica-Bold').text(nome, mx, 65, { width: larg });
      doc.moveDown(0.3);
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(contato || '', mx, doc.y, { width: larg });
      doc.moveDown(0.8);
      doc.moveTo(mx, doc.y).lineTo(doc.page.width - mx, doc.y).strokeColor('#2563eb').lineWidth(1.5).stroke();
      doc.moveDown(1);

      // Data
      const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.fillColor('#9ca3af').fontSize(9).font('Helvetica').text(hoje, mx, doc.y, { align: 'right', width: larg });
      doc.moveDown(1.5);

      // Corpo
      const paragrafos = carta.split('\n').filter(p => p.trim().length > 0);
      paragrafos.forEach((p, i) => {
        doc.fillColor('#1f2937').fontSize(10.5).font('Helvetica')
          .text(p.trim(), mx, doc.y, { width: larg, align: 'justify', lineGap: 3 });
        if (i < paragrafos.length - 1) doc.moveDown(0.9);
      });

      // Rodapé
      doc.fillColor('#d1d5db').fontSize(7.5).font('Helvetica')
        .text('Gerado por MatchCV', mx, doc.page.height - 35, { align: 'center', width: larg });

      doc.end();
    } catch (err) { reject(err); }
  });
}