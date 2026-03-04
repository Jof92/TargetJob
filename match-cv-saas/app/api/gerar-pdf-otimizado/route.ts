// app/api/gerar-pdf-otimizado/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { gerarPDFOtimizado, type CVData } from '@/utils/pdfGenerator';

export async function POST(request: Request) {
  try {
    const { cvOriginal, vaga, skillsAdicionais, missingSkills, idiomaVaga } = await request.json();

    if (!cvOriginal?.trim() || !vaga?.trim()) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    const variacao = Math.floor(Math.random() * 4) + 1;
    const seed = Date.now();
    const estilos = [
      'narrative focused on technical competence and process mastery',
      'narrative focused on leadership, coordination and organizational impact',
      'narrative focused on strategic management and decision-making',
      'narrative focused on operational optimization and delivery excellence',
    ];
    const estiloAtual = estilos[variacao - 1];

    const idioma = idiomaVaga || 'pt';
    const instrucaoIdioma =
      idioma === 'en' ? 'WRITE THE ENTIRE CV IN ENGLISH — all sections, bullets, summary, skills, education.' :
      idioma === 'es' ? 'ESCRIBE TODO EL CV EN ESPAÑOL.' :
      idioma === 'fr' ? 'RÉDIGEZ TOUT LE CV EN FRANÇAIS.' :
      'ESCREVA TODO O CV EM PORTUGUÊS BRASILEIRO.';

    const prompt = `
You are a senior headhunter and ATS expert — VERSION ${variacao} OF 4 (seed: ${seed}).
Style: ${estiloAtual}

⚠️ LANGUAGE RULE: ${instrucaoIdioma}

GENERATE A COMPLETELY DIFFERENT VERSION — different vocabulary, structure, verb choices, bullet order.

═══════════════════════════════════
ORIGINAL CV:
═══════════════════════════════════
${cvOriginal}

═══════════════════════════════════
TARGET JOB:
═══════════════════════════════════
${vaga}

═══════════════════════════════════
ADDITIONAL SKILLS:
═══════════════════════════════════
${skillsAdicionais?.length ? skillsAdicionais.join(', ') : 'None'}

═══════════════════════════════════
MISSING SKILLS:
═══════════════════════════════════
${missingSkills?.length ? missingSkills.join(', ') : 'None'}

═══════════════════════════════════
MANDATORY RULES:
═══════════════════════════════════
1. PRESERVE EXACTLY: name, email, phone, LinkedIn, companies, job titles, periods, institutions, courses, years
2. PROFESSIONAL SUMMARY:
   - First sentence: exact job title from posting + company sector
   - Second sentence: connect 2-3 key requirements with real candidate experience
   - Third sentence: concrete value proposition — what candidate DELIVERS
   - FORBIDDEN: "dedicated professional", "seeking new challenges", "extensive experience"
   - Max 4 lines
3. EXPERIENCE bullets:
   - 4-6 bullets per role
   - Integrate additional skills naturally
   - Use EXACT job posting keywords for ATS
   - ⛔ NEVER invent percentages or numerical metrics absent from original CV
   - ✅ Use solid qualitative results: "ensuring full contract lifecycle compliance", "eliminating approval bottlenecks", "consolidating strategic supplier base"
   - Tone: confident, technical, direct
4. SKILLS: all from original + additional + job keywords
5. LANGUAGES: extract ALL from original CV with levels
6. Each bullet starts with "• " separated by \\n
7. ⚠️ ENTIRE CV in the language specified above

RETURN ONLY PURE JSON:
{
  "nome": "Exact name",
  "contato": "email | phone | linkedin",
  "resumo": "Summary version ${variacao}",
  "experiencias": [
    { "cargo": "Title", "empresa": "Company", "periodo": "Period", "descricao": "• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4" }
  ],
  "habilidades": ["skill1", "skill2"],
  "idiomas": [{ "idioma": "Language", "nivel": "Level" }],
  "educacao": [{ "curso": "Course", "instituicao": "Institution", "ano": "Year" }],
  "vagaResumo": "Job summary 2 lines",
  "salario": "Salary or 'Not informed'",
  "beneficios": "Benefits or 'Not informed'"
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a senior headhunter generating VERSION ${variacao} of 4 of a CV.
Style: ${estiloAtual}. Language: ${instrucaoIdioma}
- NEVER invent percentages or numerical metrics absent from original CV
- NEVER use "dedicated professional", "seeking new challenges", "extensive experience"
- ALWAYS mention the target job title and company sector in the first summary sentence
- Use COMPLETELY DIFFERENT vocabulary and structure from other versions
- Return ONLY valid JSON, no markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    const contentLimpo = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(contentLimpo);
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }

    if (!parsed.nome || !Array.isArray(parsed.experiencias) || !parsed.experiencias.length) {
      throw new Error('AI did not generate a valid CV structure.');
    }

    parsed.habilidades = parsed.habilidades || [];
    parsed.educacao = parsed.educacao || [];
    parsed.idiomas = Array.isArray(parsed.idiomas) ? parsed.idiomas : [];
    parsed.experiencias = parsed.experiencias.map((exp: any) => ({
      ...exp,
      descricao: String(exp.descricao || '').replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    }));

    const cvData: CVData = {
      nome: parsed.nome,
      contato: parsed.contato,
      resumo: parsed.resumo,
      experiencias: parsed.experiencias,
      habilidades: parsed.habilidades,
      idiomas: parsed.idiomas,
      educacao: parsed.educacao,
    };

    const pdfBuffer = await gerarPDFOtimizado(cvData);
    const base64PDF = pdfBuffer.toString('base64');

    console.log(`✅ PDF v${variacao} gerado para:`, cvData.nome);

    return NextResponse.json({
      cvData,
      pdfBase64: base64PDF,
      versao: variacao,
      vagaResumo: parsed.vagaResumo || null,
      salario: parsed.salario || 'Não informado',
      beneficios: parsed.beneficios || 'Não informado',
    });

  } catch (error: any) {
    console.error('💥 Erro ao gerar PDF:', error?.message);
    return NextResponse.json({ error: error?.message || 'Erro ao gerar PDF' }, { status: 500 });
  }
}