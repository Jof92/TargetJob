// app/api/gerar-pdf-otimizado/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { gerarPDFOtimizado, type CVData } from '@/utils/pdfGenerator';

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

    const prompt = `
Você é um headhunter sênior especialista em ATS e otimização de currículos.
Reescreva o currículo abaixo para MAXIMIZAR as chances de aprovação na vaga específica.

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
   - Primeira frase: mencionar o CARGO EXATO da vaga e o SETOR/ÁREA da empresa (ex: "Procurement Specialist com foco em gestão de contratos para o setor de consultoria de TI")
   - Segunda frase: conectar os 2-3 principais requisitos da vaga com experiências reais do candidato
   - Terceira frase: proposta de valor concreta — o que o candidato ENTREGA, não quem ele "é"
   - PROIBIDO: "profissional dedicado", "busca novos desafios", "ampla experiência", "perfil dinâmico", "proativo", "comprometido"
   - Máximo 4 linhas, linguagem direta, específica e orientada à vaga

3. EXPERIÊNCIAS — para cada cargo:
   - 4 a 6 bullet points ricos, detalhados e orientados a resultados
   - Integrar as skills adicionais naturalmente onde fizer sentido real
   - Usar palavras-chave EXATAS da vaga para passar no ATS
   - Adicionar métricas e resultados concretos onde possível (%, tempo, escala, valor)

4. HABILIDADES: incluir todas do original + skills adicionais + keywords relevantes da vaga

5. IDIOMAS: extrair do currículo original TODOS os idiomas mencionados com seus níveis.
   Se não houver idiomas no CV mas a vaga exigir ou mencionar algum idioma, incluir o idioma da vaga com nível "A verificar".
   Formato: [{ "idioma": "Português", "nivel": "Nativo" }, { "idioma": "Inglês", "nivel": "Intermediário" }]

6. NÃO inventar empresas, cargos, períodos ou formações inexistentes

7. Cada bullet point DEVE começar com "• " e ser separado por \\n

═══════════════════════════════════
EXEMPLO DE RESUMO CORRETO:
═══════════════════════════════════
"Procurement Specialist com 10 anos de experiência em gestão de contratos e compras indiretas para o setor de incorporação e construção civil. Histórico comprovado em negociação com fornecedores, implementação de sistemas ERP e otimização de processos de compra que resultaram em reduções de custo significativas. Entrega estruturação de ciclo completo de contratos, desde a negociação até o encerramento, com foco em compliance e eficiência operacional."

═══════════════════════════════════
EXEMPLO DE BULLET POINTS CORRETOS:
═══════════════════════════════════
"• Gerenciei ciclo completo de contratos (contract lifecycle) com fornecedores estratégicos, desde negociação até encerramento, reduzindo custos operacionais em 18%\\n• Conduzi processos de indirect procurement para serviços de consultoria e tecnologia, garantindo SLAs e compliance documental\\n• Implementei e administrei módulos do SAP R/3 para gestão de pedidos, contratos e relatórios gerenciais\\n• Desenvolvi dashboards no Excel Avançado e Power BI para monitoramento de KPIs de fornecedores e orçamento\\n• Mantive base de documentação obrigatória de fornecedores atualizada, assegurando conformidade regulatória"

═══════════════════════════════════
EXTRAIA TAMBÉM DA VAGA:
═══════════════════════════════════
- vagaResumo: 2 linhas (empresa/cargo/local/modelo de trabalho)
- salario: valor exato mencionado na vaga. Se não houver, use "Não informado"

═══════════════════════════════════
RETORNE APENAS JSON PURO — SEM MARKDOWN:
═══════════════════════════════════
{
  "nome": "Nome exato",
  "contato": "email | telefone | linkedin",
  "resumo": "Resumo profissional altamente direcionado à vaga",
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
    { "idioma": "Português", "nivel": "Nativo" },
    { "idioma": "Inglês", "nivel": "Intermediário" }
  ],
  "educacao": [
    {
      "curso": "Curso exato",
      "instituicao": "Instituição exata",
      "ano": "Ano exato"
    }
  ],
  "vagaResumo": "Resumo da vaga em 2 linhas",
  "salario": "Salário extraído ou 'Não informado'"
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Você é um headhunter sênior especialista em ATS.
Ao escrever o resumo profissional do CV:
- NUNCA use frases genéricas como "profissional dedicado", "busca novos desafios", "ampla experiência" ou "perfil dinâmico"
- SEMPRE mencione o cargo-alvo e o setor da empresa da vaga na primeira frase
- SEMPRE conecte as conquistas do candidato com os requisitos específicos da vaga
- Escreva como se o candidato já fosse a pessoa ideal para aquela posição
Retorne APENAS JSON válido, sem markdown, sem texto antes ou depois.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia da IA');

    const contentLimpo = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('📄 JSON da IA (500 chars):', contentLimpo.substring(0, 500));

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

    // Garantir arrays
    parsed.habilidades = parsed.habilidades || [];
    parsed.educacao = parsed.educacao || [];
    parsed.idiomas = Array.isArray(parsed.idiomas) ? parsed.idiomas : [];

    // Normalizar \n literal em quebra real
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

    console.log('✅ PDF gerado para:', cvData.nome);

    return NextResponse.json({
      cvData,
      pdfBase64: base64PDF,
      vagaResumo: parsed.vagaResumo || null,
      salario: parsed.salario || 'Não informado',
      message: 'PDF otimizado gerado com sucesso!',
    });

  } catch (error: any) {
    console.error('💥 Erro ao gerar PDF:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar PDF otimizado' },
      { status: 500 }
    );
  }
}