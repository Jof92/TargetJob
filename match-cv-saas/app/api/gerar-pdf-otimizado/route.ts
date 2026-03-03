// app/api/gerar-pdf-otimizado/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { gerarPDFOtimizado, type CVData } from '@/utils/pdfGenerator';

const VERBOS_ACAO = [
  ['gerenciei', 'coordenei', 'liderei', 'conduzi', 'supervisionei', 'administrei', 'dirigi'],
  ['implementei', 'desenvolvi', 'criei', 'estruturei', 'estabeleci', 'implantei', 'concebi'],
  ['otimizei', 'aprimorei', 'melhorei', 'refinei', 'reestruturei', 'modernizei', 'acelerei'],
  ['negociei', 'articulei', 'mediei', 'firmei', 'conduzindo', 'estabelecendo', 'alinhei'],
  ['reduzi', 'cortei', 'eliminei', 'diminuí', 'enxuguei', 'minimizei', 'controlei'],
];

export async function POST(request: Request) {
  try {
    const { cvOriginal, vaga, skillsAdicionais, missingSkills } = await request.json();

    if (!cvOriginal?.trim() || !vaga?.trim()) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });

    // Variação aleatória para forçar textos diferentes a cada geração
    const variacao = Math.floor(Math.random() * 4) + 1;
    const seed = Date.now();
    const estilos = [
      'narrativa cronológica focada em crescimento e progressão de carreira',
      'narrativa orientada a resultados e métricas concretas com foco quantitativo',
      'narrativa focada em liderança, processos e impacto organizacional',
      'narrativa focada em inovação, otimização e transformação de processos',
    ];
    const estiloAtual = estilos[variacao - 1];

    const prompt = `
Você é um headhunter sênior especialista em ATS — VERSÃO ${variacao} DE 4 (seed: ${seed}).

╔══════════════════════════════════════════╗
║  GERE UMA VERSÃO COMPLETAMENTE DIFERENTE ║
╚══════════════════════════════════════════╝

Esta é a versão ${variacao} de 4 possíveis versões do currículo.
Estilo desta versão: ${estiloAtual}

VOCÊ DEVE OBRIGATORIAMENTE:
✦ Usar vocabulário e sinônimos DIFERENTES — nunca repita as mesmas frases
✦ Mudar a ESTRUTURA das frases completamente (não apenas trocar palavras)
✦ Reordenar os bullet points — destaque aspectos DIFERENTES de cada experiência
✦ Reescrever o resumo com abordagem narrativa COMPLETAMENTE diferente
✦ Variar os verbos de ação — use: coordenei, liderei, estruturei, articulei, aprimorei, implantei, concebi, refinei, firmei, enxuguei (nunca repita os mesmos)
✦ Destacar ângulos diferentes da mesma experiência (ex: versão 1 foca em custos, versão 2 foca em processos, versão 3 foca em equipes, versão 4 foca em tecnologia)

═══════════════════════════════════
CURRÍCULO ORIGINAL:
═══════════════════════════════════
${cvOriginal}

═══════════════════════════════════
VAGA ALVO:
═══════════════════════════════════
${vaga}

═══════════════════════════════════
SKILLS ADICIONAIS DO CANDIDATO:
═══════════════════════════════════
${skillsAdicionais?.length ? skillsAdicionais.join(', ') : 'Nenhuma'}

═══════════════════════════════════
SKILLS AUSENTES IDENTIFICADAS:
═══════════════════════════════════
${missingSkills?.length ? missingSkills.join(', ') : 'Nenhuma'}

═══════════════════════════════════
REGRAS OBRIGATÓRIAS:
═══════════════════════════════════
1. PRESERVAR EXATAMENTE: nome, email, telefone, LinkedIn, empresas, cargos, períodos, instituições, cursos, anos e idiomas do original

2. RESUMO PROFISSIONAL — regras estritas:
   - Primeira frase: mencionar o CARGO EXATO da vaga e o SETOR/ÁREA da empresa
   - Segunda frase: conectar os 2-3 principais requisitos da vaga com experiências reais do candidato
   - Terceira frase: proposta de valor concreta — o que o candidato ENTREGA
   - PROIBIDO: "profissional dedicado", "busca novos desafios", "ampla experiência", "perfil dinâmico", "proativo", "comprometido"
   - O texto DEVE ser visivelmente diferente de outras versões por usar o estilo: ${estiloAtual}
   - Máximo 4 linhas

3. EXPERIÊNCIAS:
   - 4 a 6 bullet points por cargo
   - Integrar skills adicionais naturalmente
   - Usar palavras-chave EXATAS da vaga para ATS
   - Métricas e resultados concretos (%, tempo, escala, valor)
   - Bullet points em ordem DIFERENTE das outras versões

4. HABILIDADES: todas do original + skills adicionais + keywords da vaga

5. IDIOMAS: extrair todos os idiomas do CV com seus níveis.
   Formato: [{ "idioma": "Português", "nivel": "Nativo" }]

6. NÃO inventar empresas, cargos, períodos ou formações

7. Cada bullet point começa com "• " separado por \\n

═══════════════════════════════════
EXTRAIA DA VAGA:
═══════════════════════════════════
- vagaResumo: 2 linhas (empresa/cargo/local/modelo)
- salario: valor exato ou "Não informado"

═══════════════════════════════════
RETORNE APENAS JSON PURO:
═══════════════════════════════════
{
  "nome": "Nome exato",
  "contato": "email | telefone | linkedin",
  "resumo": "Resumo versão ${variacao} — estilo ${estiloAtual}",
  "experiencias": [
    {
      "cargo": "Cargo exato",
      "empresa": "Empresa exata",
      "periodo": "Período exato",
      "descricao": "• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4\\n• Bullet 5"
    }
  ],
  "habilidades": ["skill1", "skill2", "skill3"],
  "idiomas": [
    { "idioma": "Português", "nivel": "Nativo" }
  ],
  "educacao": [
    {
      "curso": "Curso exato",
      "instituicao": "Instituição exata",
      "ano": "Ano exato"
    }
  ],
  "vagaResumo": "Resumo da vaga",
  "salario": "Salário ou 'Não informado'"
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Você é um headhunter sênior gerando a VERSÃO ${variacao} de 4 versões diferentes de um currículo.
Esta versão usa o estilo: ${estiloAtual}.
NUNCA use as mesmas frases, estrutura ou verbos que usaria em outra versão.
NUNCA use: "profissional dedicado", "busca novos desafios", "ampla experiência", "perfil dinâmico".
SEMPRE mencione o cargo-alvo e setor da empresa na primeira frase do resumo.
Retorne APENAS JSON válido, sem markdown, sem texto antes ou depois.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia da IA');

    const contentLimpo = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log(`📄 Versão ${variacao} — JSON (500 chars):`, contentLimpo.substring(0, 500));

    let parsed: any;
    try {
      parsed = JSON.parse(contentLimpo);
    } catch {
      console.error('❌ JSON inválido:', contentLimpo);
      throw new Error('A IA retornou JSON inválido. Tente novamente.');
    }

    if (!parsed.nome || !Array.isArray(parsed.experiencias) || parsed.experiencias.length === 0) {
      console.error('❌ Estrutura inválida:', JSON.stringify(parsed, null, 2));
      throw new Error('IA não gerou CV com estrutura válida');
    }

    parsed.habilidades = parsed.habilidades || [];
    parsed.educacao = parsed.educacao || [];
    parsed.idiomas = Array.isArray(parsed.idiomas) ? parsed.idiomas : [];

    parsed.experiencias = parsed.experiencias.map((exp: any) => ({
      ...exp,
      descricao: String(exp.descricao || '')
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
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

    console.log(`✅ PDF versão ${variacao} gerado para:`, cvData.nome);

    return NextResponse.json({
      cvData,
      pdfBase64: base64PDF,
      versao: variacao,
      estilo: estiloAtual,
      vagaResumo: parsed.vagaResumo || null,
      salario: parsed.salario || 'Não informado',
      message: `PDF otimizado gerado — versão ${variacao} (${estiloAtual})`,
    });

  } catch (error: any) {
    console.error('💥 Erro ao gerar PDF:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar PDF otimizado' },
      { status: 500 }
    );
  }
}