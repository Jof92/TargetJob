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
Você é um especialista sênior em recrutamento, ATS e otimização de currículos.
Seu objetivo é reescrever o currículo abaixo para MAXIMIZAR as chances de aprovação na vaga.

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
1. PRESERVAR EXATAMENTE: nome, email, telefone, LinkedIn, nomes de empresas, cargos, períodos, instituições, cursos e anos
2. EXPANDIR cada experiência com 4 a 6 bullet points ricos e orientados a resultados
3. INTEGRAR skills adicionais naturalmente nos bullet points onde fizer sentido real
4. REESCREVER o resumo com foco nos requisitos da vaga (3-4 linhas)
5. USAR palavras-chave exatas da vaga para passar no ATS
6. ADICIONAR métricas e resultados concretos onde possível (%, tempo, escala)
7. NÃO inventar empresas, cargos, períodos ou formações inexistentes
8. HABILIDADES: incluir todas do original + skills adicionais + keywords relevantes da vaga
9. Cada bullet point DEVE começar com "• " (bullet e espaço)
10. Separar bullet points com \\n

═══════════════════════════════════
EXEMPLO DE DESCRIÇÃO CORRETA:
═══════════════════════════════════
"• Gerenciei ciclo completo de contratos (contract lifecycle) com fornecedores, desde negociação até encerramento, reduzindo custos em 15%\\n• Conduzi processos de indirect procurement com foco em otimização de custos e melhoria de SLAs\\n• Implementei e administrei módulos do SAP R/3 para gestão de pedidos e contratos\\n• Desenvolvi dashboards no Excel Avançado e Power BI para monitoramento de KPIs de fornecedores\\n• Mantive base de documentação obrigatória de fornecedores atualizada, garantindo compliance"

═══════════════════════════════════
TAMBÉM EXTRAIA DA VAGA:
═══════════════════════════════════
- vagaResumo: resumo da vaga em 2 linhas (empresa, cargo, local, modelo de trabalho)
- salario: salário mencionado na vaga como string (ex: "€1.200 a €2.000 + Food Allowance + Flex Benefits"). Se não houver, use "Não informado"

═══════════════════════════════════
RETORNE APENAS JSON PURO — SEM MARKDOWN:
═══════════════════════════════════
{
  "nome": "Nome exato",
  "contato": "email | telefone | linkedin",
  "resumo": "Resumo otimizado para a vaga em 3-4 linhas",
  "experiencias": [
    {
      "cargo": "Cargo exato",
      "empresa": "Empresa exata",
      "periodo": "Período exato",
      "descricao": "• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4\\n• Bullet 5"
    }
  ],
  "habilidades": ["skill1", "skill2", "skill3"],
  "educacao": [
    {
      "curso": "Curso exato",
      "instituicao": "Instituição exata",
      "ano": "Ano exato"
    }
  ],
  "vagaResumo": "Resumo da vaga em 2 linhas",
  "salario": "Salário extraído da vaga ou 'Não informado'"
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em currículos e ATS. Retorne APENAS JSON válido, sem markdown, sem texto antes ou depois.',
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

    // Validação mínima
    if (!parsed.nome || !Array.isArray(parsed.experiencias) || parsed.experiencias.length === 0) {
      console.error('❌ Estrutura inválida:', JSON.stringify(parsed, null, 2));
      throw new Error('IA não gerou CV com estrutura válida');
    }

    // Garantir arrays
    parsed.habilidades = parsed.habilidades || [];
    parsed.educacao = parsed.educacao || [];

    // Normalizar \n literal em quebra real nos bullet points
    parsed.experiencias = parsed.experiencias.map((exp: any) => ({
      ...exp,
      descricao: String(exp.descricao || '')
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    }));

    // Extrair cvData sem campos extras
    const cvData: import('@/utils/pdfGenerator').CVData = {
      nome: parsed.nome,
      contato: parsed.contato,
      resumo: parsed.resumo,
      experiencias: parsed.experiencias,
      habilidades: parsed.habilidades,
      educacao: parsed.educacao,
    };

    const pdfBuffer = await gerarPDFOtimizado(cvData);
    const base64PDF = pdfBuffer.toString('base64');

    console.log('✅ PDF gerado com sucesso para:', cvData.nome);

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