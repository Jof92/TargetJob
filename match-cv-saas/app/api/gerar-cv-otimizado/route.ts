// app/api/gerar-cv-otimizado/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { cvOriginal, vaga, skillsAdicionais, missingSkills } = await request.json();

    if (!cvOriginal?.trim() || !vaga?.trim() || !skillsAdicionais?.length) {
      return NextResponse.json(
        { error: 'Dados incompletos para gerar CV otimizado' },
        { status: 400 }
      );
    }

    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    const prompt = `
Você é um especialista em otimização de currículos para ATS (Applicant Tracking Systems).

TAREFA:
Reescreva o currículo original incluindo de forma NATURAL e HONESTA as habilidades adicionais que o candidato possui mas não estavam no CV.

REGRAS IMPORTANTES:
1. Mantenha TODAS as informações originais do CV
2. Adicione as skills marcadas de forma orgânica (não apenas liste)
3. Integre as skills nas experiências profissionais quando fizer sentido
4. Use palavras-chave da descrição da vaga
5. Mantenha o formato profissional de currículo
6. NÃO invente experiências ou cargos que não existiam
7. Seja específico - em vez de "conheço Python", use "desenvolvi X com Python"

DADOS:
- Skills que o candidato tem mas não estavam no CV: ${skillsAdicionais.join(', ')}
- Todas as skills faltantes identificadas: ${missingSkills.join(', ')}

CV ORIGINAL:
${cvOriginal}

DESCRIÇÃO DA VAGA:
${vaga}

RETORNE APENAS o texto do CV otimizado, sem comentários, sem markdown, sem explicações.
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Um pouco mais criativo para redação
      max_tokens: 2000
    });

    const cvOtimizado = completion.choices[0]?.message?.content?.trim();

    if (!cvOtimizado) {
      throw new Error('IA não gerou conteúdo válido');
    }

    return NextResponse.json({ cvOtimizado });
    
  } catch (error: any) {
    console.error('💥 Erro ao gerar CV:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar CV otimizado' },
      { status: 500 }
    );
  }
}