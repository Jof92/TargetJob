// app/api/analisar-match/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { cv, vaga } = await request.json();

    if (!cv?.trim() || !vaga?.trim()) {
      return NextResponse.json({ error: 'CV e vaga são obrigatórios' }, { status: 400 });
    }

    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    const prompt = `
Você é um recrutador sênior extremamente exigente, especialista em ATS.
Analise o CV e a vaga abaixo com olhar crítico, detalhado e realista.

RETORNE APENAS JSON válido com esta estrutura COMPLETA:
{
  "score": number (0-100),
  "idioma_vaga": "pt" | "en" | "es" | "fr",
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skillX", "skillY"],
  "analise_score": {
    "pontos_fortes": ["razão específica que contribuiu para o score", "outra razão"],
    "pontos_fracos": ["razão específica que derrubou o score", "outra razão", "mais uma"],
    "gap_principal": "Explicação CIRÚRGICA e DETALHADA do principal motivo pelo qual o score não foi maior. Seja específico: mencione ferramentas, setores, experiências ou competências que faltam. Ex: 'O CV não evidencia experiência com SAP MM/SRM, módulo central da vaga. Além disso, o candidato nunca atuou no setor de construção civil, que tem dinâmicas de fornecimento muito específicas exigidas pela vaga.'",
    "chance_entrevista": "Alta" | "Média" | "Baixa",
    "veredicto": "Frase direta e honesta de 1-2 linhas. Ex: 'Perfil com base técnica sólida em procurement, mas distante do setor e das ferramentas específicas da vaga. Precisa evidenciar SAP e experiência em contratos de obras.'"
  },
  "quick_wins": ["ação concreta 1", "ação concreta 2", "ação concreta 3"],
  "vagaResumo": "Resumo em 2 linhas: empresa, cargo, local, modelo",
  "salario": "Valor exato ou 'Não informado'",
  "beneficios": "Lista dos benefícios mencionados ou 'Não informado'"
}

CRITÉRIOS DE SCORE (use para calcular com precisão):
- Experiência no mesmo setor da vaga: até 25 pontos
- Ferramentas/sistemas específicos exigidos: até 25 pontos
- Nível de senioridade compatível: até 20 pontos
- Keywords da vaga presentes no CV: até 15 pontos
- Idioma e localização: até 15 pontos

REGRAS CRÍTICAS:
1. JSON puro, SEM markdown, SEM texto fora do JSON
2. Arrays NUNCA vazios
3. analise_score é OBRIGATÓRIO e DETALHADO — é o coração da análise
4. pontos_fracos: mínimo 3 itens, cada um explicando ESPECIFICAMENTE o que derrubou o score
5. gap_principal: seja cirúrgico — mencione ferramentas, setores, competências ausentes pelo nome
6. ⛔ PROIBIDO inventar porcentagens ou métricas numéricas
7. quick_wins: ações CONCRETAS que o candidato pode tomar no CV agora

CV:
${cv.substring(0, 6000)}

VAGA:
${vaga.substring(0, 6000)}

JSON:
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Você é um recrutador sênior extremamente exigente e honesto.
Sua análise deve ser DETALHADA — o candidato precisa entender EXATAMENTE por que o score foi aquele valor.
Se o score foi baixo, explique com precisão o que falta. Não seja vago.
NUNCA infle scores. NUNCA use métricas inventadas.
Retorne APENAS JSON válido, sem markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    let content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('IA retornou resposta vazia');

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let resultado: any;
    try {
      resultado = JSON.parse(content);
    } catch {
      throw new Error('Resposta da IA não é JSON válido. Tente novamente.');
    }

    // Validações e fallbacks
    if (!resultado.score) resultado.score = 0;
    if (!resultado.idioma_vaga) resultado.idioma_vaga = 'pt';
    if (!resultado.matching_skills?.length) resultado.matching_skills = ['Nenhuma identificada'];
    if (!resultado.missing_skills?.length) resultado.missing_skills = ['Nenhuma faltante'];
    if (!resultado.quick_wins?.length) resultado.quick_wins = ['Revise o CV com foco nas palavras-chave da vaga'];
    if (!resultado.analise_score) {
      resultado.analise_score = {
        pontos_fortes: ['Análise não disponível'],
        pontos_fracos: ['Análise não disponível'],
        gap_principal: 'Não foi possível gerar análise detalhada.',
        chance_entrevista: 'Média',
        veredicto: 'Análise não disponível.',
      };
    }

    console.log('✅ Match analisado:', { score: resultado.score, idioma: resultado.idioma_vaga });
    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('💥 ERRO NA ANÁLISE:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao analisar match' },
      { status: 500 }
    );
  }
}