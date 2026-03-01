// app/api/analisar-match/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { cv, vaga } = await request.json();
    
    if (!cv?.trim() || !vaga?.trim()) {
      return NextResponse.json({ error: 'CV e vaga são obrigatórios' }, { status: 400 });
    }

    // ✅ baseURL SEM ESPAÇOS!
    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    const MODEL = 'llama-3.3-70b-versatile';

    // ✅ PROMPT RIGOROSO COM EXEMPLO
    const prompt = `
Você é um recrutador sênior especialista em ATS. Retorne APENAS JSON válido.

ESTRUTURA JSON OBRIGATÓRIA (preencha todos os campos):
{
  "score": number (0-100, seja rigoroso),
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skillX", "skillY"],
  "quick_wins": ["dica1", "dica2"],
  "resumo": "Frase curta e motivacional"
}

REGRAS CRÍTICAS:
1. Retorne APENAS JSON puro, SEM markdown, SEM \`\`\`, SEM explicações
2. Arrays NUNCA podem estar vazios (use ["Nenhuma identificada"] se necessário)
3. Score deve ser número inteiro entre 0-100
4. Não invente skills que não estão no CV ou na vaga

CV PARA ANÁLISE:
${cv.substring(0, 6000)}

VAGA PARA ANÁLISE:
${vaga.substring(0, 6000)}

JSON (sem markdown, sem explicações, apenas o objeto):
`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { 
          role: 'system', 
          content: 'Você retorna APENAS JSON válido. Nada de markdown, nada de texto explicativo. Apenas o objeto JSON puro.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    let content = completion.choices[0]?.message?.content;
    
    // 🐛 DEBUG LOG
    console.log('📥 Resposta bruta da IA:', content?.substring(0, 400) + '...');

    if (!content) {
      throw new Error('IA retornou resposta vazia');
    }

    // 🧹 LIMPEZA DE MARKDOWN E CARACTERES EXTRAS
    content = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/^\s*[\r\n]/gm, '')
      .trim();

    console.log('🧹 JSON após limpeza:', content.substring(0, 300) + '...');

    // 🔄 PARSE SEGURO
    let resultado;
    try {
      resultado = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('📄 Conteúdo que falhou:', content);
      throw new Error('Resposta da IA não é um JSON válido. Tente novamente.');
    }

    // ✅ VALIDAÇÃO DA ESTRUTURA
    const camposObrigatorios = ['score', 'matching_skills', 'missing_skills', 'quick_wins', 'resumo'];
    for (const campo of camposObrigatorios) {
      if (!(campo in resultado)) {
        console.error(`❌ Campo faltando: ${campo}`, resultado);
        throw new Error(`Resposta da IA está incompleta: faltando "${campo}"`);
      }
    }

    // Garantir que arrays não estejam vazios
    if (resultado.matching_skills.length === 0) resultado.matching_skills = ['Nenhuma identificada'];
    if (resultado.missing_skills.length === 0) resultado.missing_skills = ['Nenhuma faltante'];
    if (resultado.quick_wins.length === 0) resultado.quick_wins = ['CV já está bem otimizado'];

    console.log('✅ Match analisado com sucesso:', { score: resultado.score });

    return NextResponse.json(resultado);
    
  } catch (error: any) {
    console.error('💥 ERRO NA ANÁLISE:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao analisar match' },
      { status: 500 }
    );
  }
}