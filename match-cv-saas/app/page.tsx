'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [cv, setCv] = useState('');
  const [vaga, setVaga] = useState('');
  const [arquivoPDF, setArquivoPDF] = useState<File | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [skillsMarcadas, setSkillsMarcadas] = useState<string[]>([]);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [pdfURL, setPdfURL] = useState<string | null>(null);
  const [cvData, setCvData] = useState<any>(null);
  const [vagaResumo, setVagaResumo] = useState<string | null>(null);
  const [salario, setSalario] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload de PDF ────────────────────────────────────────────────
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      setErro('Apenas arquivos PDF são permitidos');
      return;
    }

    setArquivoPDF(file);
    setCarregando(true);
    setErro('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);

      setCv(dados.textoCV);
      alert('✅ PDF carregado com sucesso!');
    } catch (err: any) {
      setErro(err.message);
      setCv('');
    } finally {
      setCarregando(false);
    }
  };

  // ── Analisar Match ───────────────────────────────────────────────
  const analisarMatch = async () => {
    if (!cv.trim() || !vaga.trim()) {
      setErro('Preencha o currículo e a descrição da vaga');
      return;
    }

    setCarregando(true);
    setErro('');
    setResultado(null);
    setSkillsMarcadas([]);
    setPdfURL(null);
    setVagaResumo(null);
    setSalario(null);

    try {
      const res = await fetch('/api/analisar-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv, vaga }),
      });

      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);

      const resultadoLimpo = {
        score: Number(dados.score) || 0,
        resumo: String(dados.resumo || ''),
        matching_skills: (dados.matching_skills || []).map((s: any) => String(s)),
        missing_skills: (dados.missing_skills || []).map((s: any) => String(s)),
        quick_wins: (dados.quick_wins || []).map((s: any) => String(s)),
      };

      setResultado(resultadoLimpo);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSkillsMarcadas((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // ── Gerar PDF Otimizado ──────────────────────────────────────────
  const gerarPDFOtimizado = async () => {
    if (skillsMarcadas.length === 0) {
      alert('Marque pelo menos uma habilidade!');
      return;
    }

    setGerandoPDF(true);
    setErro('');
    setVagaResumo(null);
    setSalario(null);

    try {
      const res = await fetch('/api/gerar-pdf-otimizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvOriginal: cv,
          vaga: vaga,
          skillsAdicionais: skillsMarcadas,
          missingSkills: resultado?.missing_skills || [],
        }),
      });

      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);

      setCvData(dados.cvData);
      setVagaResumo(dados.vagaResumo || null);
      setSalario(dados.salario || null);

      const blob = base64ToBlob(dados.pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(blob);
      setPdfURL(url);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setGerandoPDF(false);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const clean = base64.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  };

  const baixarPDF = () => {
    if (!pdfURL) return;
    const link = document.createElement('a');
    link.href = pdfURL;
    link.download = `cv-otimizado-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(pdfURL), 100);
  };

  const visualizarPDF = () => {
    if (pdfURL) window.open(pdfURL, '_blank');
  };

  const scoreColor =
    resultado?.score >= 70
      ? 'text-green-600'
      : resultado?.score >= 40
      ? 'text-yellow-500'
      : 'text-red-500';

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-4xl font-bold text-gray-800">🎯 MatchCV</h1>
          <p className="text-gray-500 mt-1">Upload de PDF → Análise de Match → CV Otimizado</p>
        </div>

        {/* Upload PDF */}
        <div className="bg-white rounded-xl shadow p-5">
          <label className="block font-semibold text-gray-700 mb-2">📄 Upload do Currículo (PDF)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePDFUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          {arquivoPDF && (
            <p className="mt-2 text-sm text-green-600 font-medium">✅ {arquivoPDF.name}</p>
          )}
          {carregando && !resultado && (
            <p className="mt-2 text-sm text-blue-500 animate-pulse">🔄 Extraindo texto do PDF...</p>
          )}
        </div>

        {/* CV Text */}
        <div className="bg-white rounded-xl shadow p-5">
          <label className="block font-semibold text-gray-700 mb-2">📝 Ou cole o texto do currículo</label>
          <textarea
            className="w-full p-3 border border-gray-200 rounded-lg min-h-[140px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
            placeholder="Cole aqui o texto do seu currículo..."
            value={cv}
            onChange={(e) => setCv(e.target.value)}
          />
          {cv && (
            <p className="mt-1 text-xs text-gray-400 text-right">{cv.length} caracteres</p>
          )}
        </div>

        {/* Vaga */}
        <div className="bg-white rounded-xl shadow p-5">
          <label className="block font-semibold text-gray-700 mb-2">💼 Descrição da Vaga</label>
          <textarea
            className="w-full p-3 border border-gray-200 rounded-lg min-h-[140px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
            placeholder="Cole aqui a descrição da vaga (LinkedIn, site da empresa, etc.)..."
            value={vaga}
            onChange={(e) => setVaga(e.target.value)}
          />
          {vaga && (
            <p className="mt-1 text-xs text-gray-400 text-right">{vaga.length} caracteres</p>
          )}
        </div>

        {/* Botão analisar */}
        <button
          onClick={analisarMatch}
          disabled={carregando || !cv.trim() || !vaga.trim()}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {carregando && !resultado ? '🔄 Analisando...' : '🔍 Calcular Match'}
        </button>

        {/* Erro */}
        {erro && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            ❌ {erro}
          </div>
        )}

        {/* Resultado da análise */}
        {resultado && (
          <div className="bg-white rounded-xl shadow p-5 space-y-5">

            {/* Score */}
            <div className="text-center">
              <span className={`text-6xl font-bold ${scoreColor}`}>
                {resultado.score}%
              </span>
              <p className="text-gray-500 mt-1">de compatibilidade com a vaga</p>
            </div>

            {/* Resumo da análise */}
            {resultado.resumo && (
              <p className="italic text-gray-600 text-center border-t border-b border-gray-100 py-3">
                "{resultado.resumo}"
              </p>
            )}

            {/* Quick wins */}
            {resultado.quick_wins?.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-700 mb-2">💡 Dicas rápidas</h4>
                <ul className="space-y-1">
                  {resultado.quick_wins.map((dica: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-blue-400">→</span> {dica}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills identificadas */}
            {resultado.matching_skills?.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 mb-2">✅ Habilidades identificadas</h4>
                <div className="flex flex-wrap gap-2">
                  {resultado.matching_skills.map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Skills ausentes com checkboxes */}
            {resultado.missing_skills?.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-1">❌ Habilidades não encontradas no CV</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Marque as que você possui — elas serão integradas ao CV otimizado:
                </p>
                <div className="space-y-2">
                  {resultado.missing_skills.map((skill: string, i: number) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        skillsMarcadas.includes(skill)
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={skillsMarcadas.includes(skill)}
                        onChange={() => toggleSkill(skill)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{skill}</span>
                      {skillsMarcadas.includes(skill) && (
                        <span className="ml-auto text-blue-600 text-sm font-medium">✓ Adicionada</span>
                      )}
                    </label>
                  ))}
                </div>

                {skillsMarcadas.length > 0 && (
                  <p className="mt-2 text-xs text-blue-600 font-medium">
                    {skillsMarcadas.length} habilidade{skillsMarcadas.length > 1 ? 's' : ''} selecionada{skillsMarcadas.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Botão gerar PDF */}
            {skillsMarcadas.length > 0 && (
              <button
                onClick={gerarPDFOtimizado}
                disabled={gerandoPDF}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {gerandoPDF ? '⏳ Gerando CV otimizado...' : '📄 Gerar CV Otimizado'}
              </button>
            )}

            {/* PDF Pronto */}
            {pdfURL && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200 space-y-3">
                <p className="font-semibold text-green-700 text-lg">✅ CV otimizado gerado!</p>

                {/* Resumo da vaga */}
                {vagaResumo && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
                      📋 Sobre a vaga
                    </p>
                    <p className="text-sm text-blue-800">{vagaResumo}</p>
                  </div>
                )}

                {/* Salário */}
                {salario && salario !== 'Não informado' && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-1">
                      💰 Remuneração informada
                    </p>
                    <p className="text-sm text-yellow-800 font-medium">{salario}</p>
                  </div>
                )}

                {salario === 'Não informado' && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      💰 Remuneração
                    </p>
                    <p className="text-sm text-gray-500">Não informada no anúncio</p>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={visualizarPDF}
                    className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors"
                  >
                    👁️ Visualizar
                  </button>
                  <button
                    onClick={baixarPDF}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                  >
                    💾 Baixar PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}