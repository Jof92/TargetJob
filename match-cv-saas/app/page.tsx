'use client';

import { useState, useRef } from 'react';

interface Experiencia { cargo: string; empresa: string; periodo: string; descricao: string; }
interface Educacao { curso: string; instituicao: string; ano: string; }
interface Idioma { idioma: string; nivel: string; }
interface CVEditavel {
  nome: string; contato: string; resumo: string;
  experiencias: Experiencia[]; habilidades: string[];
  idiomas: Idioma[]; educacao: Educacao[];
}

type Aba = 'input' | 'analise' | 'editor' | 'carta';

export default function Home() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('input');

  // Dados de entrada
  const [cv, setCv] = useState('');
  const [vaga, setVaga] = useState('');
  const [urlVaga, setUrlVaga] = useState('');
  const [arquivoPDF, setArquivoPDF] = useState<File | null>(null);
  const [idiomaVaga, setIdiomaVaga] = useState('pt');

  // Loading
  const [carregando, setCarregando] = useState(false);
  const [extraindoVaga, setExtraindoVaga] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [gerandoCarta, setGerandoCarta] = useState(false);

  // Erros
  const [erro, setErro] = useState('');
  const [erroVaga, setErroVaga] = useState('');

  // Análise
  const [resultado, setResultado] = useState<any>(null);
  const [skillsMarcadas, setSkillsMarcadas] = useState<string[]>([]);

  // Editor CV
  const [cvEditavel, setCvEditavel] = useState<CVEditavel | null>(null);
  const [habilidadesTexto, setHabilidadesTexto] = useState('');
  const [pdfCVUrl, setPdfCVUrl] = useState<string | null>(null);

  // Carta
  const [cartaEditada, setCartaEditada] = useState('');
  const [cartaAssunto, setCartaAssunto] = useState('');
  const [pdfCartaUrl, setPdfCartaUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────
  const b64ToBlob = (b64: string, mime: string) => {
    const bin = atob(b64.replace(/^data:[^;]+;base64,/, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };
  const baixar = (url: string, nome: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // ── Upload PDF ───────────────────────────────────────────────────
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoPDF(file); setCarregando(true); setErro('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCv(d.textoCV);
    } catch (err: any) { setErro(err.message); setCv(''); }
    finally { setCarregando(false); }
  };

  // ── Extrair vaga ─────────────────────────────────────────────────
  const extrairVaga = async () => {
    if (!urlVaga.trim()) return;
    setExtraindoVaga(true); setErroVaga(''); setVaga('');
    try {
      const res = await fetch('/api/extrair-vaga', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlVaga.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setErroVaga(d.error); return; }
      setVaga(d.textoVaga);
    } catch { setErroVaga('Erro de conexão. Cole o texto manualmente.'); }
    finally { setExtraindoVaga(false); }
  };

  // ── Analisar Match ───────────────────────────────────────────────
  const analisarMatch = async () => {
    if (!cv.trim() || !vaga.trim()) { setErro('Preencha o currículo e a vaga'); return; }
    setCarregando(true); setErro(''); setResultado(null);
    setSkillsMarcadas([]); setPdfCVUrl(null); setCvEditavel(null);
    try {
      const res = await fetch('/api/analisar-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv, vaga }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResultado(d);
      setIdiomaVaga(d.idioma_vaga || 'pt');
      setAbaAtiva('analise');
    } catch (err: any) { setErro(err.message); }
    finally { setCarregando(false); }
  };

  // ── Gerar CV ─────────────────────────────────────────────────────
  const gerarCV = async () => {
    if (!skillsMarcadas.length) { alert('Marque pelo menos uma habilidade!'); return; }
    setGerandoPDF(true); setErro(''); setPdfCVUrl(null); setCvEditavel(null);
    try {
      const res = await fetch('/api/gerar-pdf-otimizado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvOriginal: cv, vaga,
          skillsAdicionais: skillsMarcadas,
          missingSkills: resultado?.missing_skills || [],
          idiomaVaga,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCvEditavel({
        nome: d.cvData.nome || '', contato: d.cvData.contato || '',
        resumo: d.cvData.resumo || '', experiencias: d.cvData.experiencias || [],
        habilidades: d.cvData.habilidades || [], idiomas: d.cvData.idiomas || [],
        educacao: d.cvData.educacao || [],
      });
      setHabilidadesTexto((d.cvData.habilidades || []).join(', '));
      setAbaAtiva('editor');
    } catch (err: any) { setErro(err.message); }
    finally { setGerandoPDF(false); }
  };

  // ── Exportar CV PDF ──────────────────────────────────────────────
  const exportarCV = async () => {
    if (!cvEditavel) return;
    const habs = habilidadesTexto.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/exportar-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvData: { ...cvEditavel, habilidades: habs } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPdfCVUrl(URL.createObjectURL(b64ToBlob(d.pdfBase64, 'application/pdf')));
    } catch (err: any) { setErro(err.message); }
  };

  // ── Gerar Carta ──────────────────────────────────────────────────
  const gerarCarta = async () => {
    if (!cvEditavel) return;
    setGerandoCarta(true); setErro(''); setPdfCartaUrl(null);
    try {
      const habs = habilidadesTexto.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/gerar-carta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvData: { ...cvEditavel, habilidades: habs }, vaga, idiomaVaga }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCartaEditada(d.carta);
      setCartaAssunto(d.assunto || '');
      setAbaAtiva('carta');
    } catch (err: any) { setErro(err.message); }
    finally { setGerandoCarta(false); }
  };

  // ── Exportar Carta PDF ───────────────────────────────────────────
  const exportarCarta = async () => {
    if (!cartaEditada.trim() || !cvEditavel) return;
    try {
      const res = await fetch('/api/gerar-carta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvData: cvEditavel, vaga, idiomaVaga, cartaPersonalizada: cartaEditada }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPdfCartaUrl(URL.createObjectURL(b64ToBlob(d.pdfBase64, 'application/pdf')));
    } catch (err: any) { setErro(err.message); }
  };

  // ── Editor helpers ───────────────────────────────────────────────
  const updExp = (i: number, k: keyof Experiencia, v: string) => {
    if (!cvEditavel) return;
    const arr = [...cvEditavel.experiencias]; arr[i] = { ...arr[i], [k]: v };
    setCvEditavel({ ...cvEditavel, experiencias: arr });
  };
  const updEdu = (i: number, k: keyof Educacao, v: string) => {
    if (!cvEditavel) return;
    const arr = [...cvEditavel.educacao]; arr[i] = { ...arr[i], [k]: v };
    setCvEditavel({ ...cvEditavel, educacao: arr });
  };
  const updIdioma = (i: number, k: keyof Idioma, v: string) => {
    if (!cvEditavel) return;
    const arr = [...cvEditavel.idiomas]; arr[i] = { ...arr[i], [k]: v };
    setCvEditavel({ ...cvEditavel, idiomas: arr });
  };

  // ── Score colors ─────────────────────────────────────────────────
  const sc = resultado?.score ?? 0;
  const scoreColor = sc >= 70 ? 'text-green-600' : sc >= 40 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = sc >= 70 ? 'bg-green-50 border-green-200' : sc >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
  const chanceMap: Record<string, string> = {
    Alta: 'text-green-700 bg-green-50 border-green-200',
    Média: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    Baixa: 'text-red-700 bg-red-50 border-red-200',
  };

  const abas: { id: Aba; label: string; enabled: boolean }[] = [
    { id: 'input',   label: '📋 Dados',    enabled: true },
    { id: 'analise', label: '📊 Análise',  enabled: !!resultado },
    { id: 'editor',  label: '✏️ Editor',   enabled: !!cvEditavel },
    { id: 'carta',   label: '✉️ Carta',    enabled: !!cartaEditada },
  ];

  const data = new Date().toISOString().split('T')[0];

  // ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">🎯 MatchCV</span>
            <span className="text-xs text-gray-400 hidden sm:block">Análise inteligente de currículo</span>
          </div>
          {resultado && (
            <div className={`px-4 py-1.5 rounded-xl border font-bold text-sm ${scoreBg} ${scoreColor}`}>
              {resultado.score}% match
              {resultado.idioma_vaga && resultado.idioma_vaga !== 'pt' && (
                <span className="ml-2 text-xs font-normal opacity-70">
                  · Vaga em {resultado.idioma_vaga === 'en' ? 'EN' : resultado.idioma_vaga === 'es' ? 'ES' : 'FR'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0">
            {abas.map(aba => (
              <button key={aba.id}
                onClick={() => aba.enabled && setAbaAtiva(aba.id)}
                disabled={!aba.enabled}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  abaAtiva === aba.id
                    ? 'border-blue-600 text-blue-600'
                    : aba.enabled
                    ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    : 'border-transparent text-gray-300 cursor-not-allowed'
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {erro && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            ❌ {erro}
            <button onClick={() => setErro('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ABA 1 — DADOS
        ════════════════════════════════════════════════════════ */}
        {abaAtiva === 'input' && (
          <div className="grid grid-cols-2 gap-6">
            {/* CV */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">👤 Seu Currículo</h2>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">📄 Upload PDF</p>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePDFUpload}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                {arquivoPDF && <p className="text-xs text-green-600 font-medium">✅ {arquivoPDF.name}</p>}
                {carregando && <p className="text-xs text-blue-500 animate-pulse">🔄 Extraindo texto...</p>}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">📝 Ou cole o texto</p>
                <textarea rows={14}
                  className="w-full p-3 border border-gray-100 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Cole aqui o texto do seu currículo..."
                  value={cv} onChange={e => setCv(e.target.value)} />
                <p className="text-xs text-gray-400 text-right">{cv.length} chars</p>
              </div>
            </div>

            {/* Vaga */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">💼 Vaga Alvo</h2>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">🔗 Link LinkedIn</p>
                <div className="flex gap-2">
                  <input type="url"
                    className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="https://linkedin.com/jobs/view/..."
                    value={urlVaga} onChange={e => setUrlVaga(e.target.value)} />
                  <button onClick={extrairVaga} disabled={extraindoVaga || !urlVaga.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap">
                    {extraindoVaga ? '🔄' : '🔗 Extrair'}
                  </button>
                </div>
                {erroVaga && (
                  <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800">
                    ⚠️ {erroVaga} Cole o texto abaixo.
                  </div>
                )}
                {vaga && !erroVaga && urlVaga && <p className="text-xs text-green-600">✅ Extraída com sucesso</p>}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">📋 Ou cole a descrição</p>
                <textarea rows={14}
                  className="w-full p-3 border border-gray-100 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Cole a descrição completa da vaga..."
                  value={vaga} onChange={e => setVaga(e.target.value)} />
                <p className="text-xs text-gray-400 text-right">{vaga.length} chars</p>
              </div>
            </div>

            {/* CTA */}
            <div className="col-span-2">
              <button onClick={analisarMatch} disabled={carregando || !cv.trim() || !vaga.trim()}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base tracking-wide">
                {carregando ? '🔄 Analisando compatibilidade...' : '🔍 Calcular Match'}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ABA 2 — ANÁLISE
        ════════════════════════════════════════════════════════ */}
        {abaAtiva === 'analise' && resultado && (
          <div className="space-y-5">

            {/* Row 1: Score + Veredicto */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-2xl border p-6 text-center flex flex-col items-center justify-center ${scoreBg}`}>
                <span className={`text-6xl font-black ${scoreColor}`}>{resultado.score}%</span>
                <p className="text-gray-500 text-sm mt-1">compatibilidade</p>
                {resultado.analise_score?.chance_entrevista && (
                  <span className={`mt-3 px-3 py-1 rounded-full border text-xs font-semibold ${chanceMap[resultado.analise_score.chance_entrevista] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    Chance: {resultado.analise_score.chance_entrevista}
                  </span>
                )}
              </div>

              <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                {resultado.analise_score?.veredicto && (
                  <p className="text-gray-700 text-sm leading-relaxed italic border-l-4 border-blue-200 pl-3">
                    "{resultado.analise_score.veredicto}"
                  </p>
                )}
                {resultado.analise_score?.gap_principal && (
                  <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">⚡ Principal gap</p>
                    <p className="text-sm text-orange-900 leading-relaxed">{resultado.analise_score.gap_principal}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Fortes / Fracos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">✅ O que contribuiu</h4>
                <ul className="space-y-2">
                  {resultado.analise_score?.pontos_fortes?.map((p: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600 leading-relaxed">
                      <span className="text-green-500 mt-0.5 shrink-0 font-bold">+</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3">⬇️ O que derrubou o score</h4>
                <ul className="space-y-2">
                  {resultado.analise_score?.pontos_fracos?.map((p: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600 leading-relaxed">
                      <span className="text-red-400 mt-0.5 shrink-0 font-bold">−</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Row 3: Info da vaga */}
            <div className="grid grid-cols-3 gap-3">
              {resultado.vagaResumo && (
                <div className="col-span-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">📋 Sobre a vaga</p>
                  <p className="text-sm text-blue-800">{resultado.vagaResumo}</p>
                </div>
              )}
              <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide mb-1">💰 Salário</p>
                <p className="text-sm text-yellow-900 font-medium">{resultado.salario || 'Não informado'}</p>
              </div>
              <div className="col-span-2 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">🎁 Benefícios</p>
                <p className="text-sm text-purple-900">{resultado.beneficios || 'Não informado'}</p>
              </div>
            </div>

            {/* Row 4: Skills */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">✅ Skills identificadas</h4>
                <div className="flex flex-wrap gap-1.5">
                  {resultado.matching_skills?.map((s: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">❌ Skills ausentes na vaga</h4>
                <p className="text-xs text-gray-400 mb-3">Marque as que você tem para integrá-las ao CV:</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {resultado.missing_skills?.map((skill: string, i: number) => (
                    <label key={i} className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer text-sm transition-colors ${skillsMarcadas.includes(skill) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-100'}`}>
                      <input type="checkbox" checked={skillsMarcadas.includes(skill)}
                        onChange={() => setSkillsMarcadas(p => p.includes(skill) ? p.filter(s => s !== skill) : [...p, skill])}
                        className="accent-blue-600 w-4 h-4" />
                      <span className="text-gray-700">{skill}</span>
                      {skillsMarcadas.includes(skill) && <span className="ml-auto text-blue-500 text-xs font-medium">✓</span>}
                    </label>
                  ))}
                </div>
                {skillsMarcadas.length > 0 && (
                  <p className="mt-2 text-xs text-blue-600 font-medium">{skillsMarcadas.length} skill{skillsMarcadas.length > 1 ? 's' : ''} selecionada{skillsMarcadas.length > 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {/* Quick wins */}
            {resultado.quick_wins?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">💡 O que fazer agora</h4>
                <div className="grid grid-cols-2 gap-2">
                  {resultado.quick_wins.map((d: string, i: number) => (
                    <div key={i} className="flex gap-2 text-sm text-gray-700 p-3 bg-blue-50 rounded-xl leading-relaxed">
                      <span className="text-blue-400 font-bold shrink-0">→</span> {d}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <button onClick={gerarCV} disabled={gerandoPDF || !skillsMarcadas.length}
              className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base">
              {gerandoPDF
                ? '⏳ Gerando CV otimizado...'
                : skillsMarcadas.length > 0
                ? `✨ Gerar CV Otimizado (${skillsMarcadas.length} skill${skillsMarcadas.length > 1 ? 's' : ''} adicionada${skillsMarcadas.length > 1 ? 's' : ''})`
                : '✨ Gerar CV Otimizado — marque skills primeiro'}
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ABA 3 — EDITOR CV
        ════════════════════════════════════════════════════════ */}
        {abaAtiva === 'editor' && cvEditavel && (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-800">✏️ Editar CV Otimizado</h2>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setCvEditavel(null); setAbaAtiva('analise'); }}
                  className="px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  ↩️ Nova versão
                </button>
                <button onClick={exportarCV}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                  📄 Exportar CV
                </button>
                <button onClick={gerarCarta} disabled={gerandoCarta}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {gerandoCarta ? '⏳ Gerando...' : '✉️ Gerar Carta'}
                </button>
              </div>
            </div>

            {pdfCVUrl && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between">
                <span className="text-sm text-green-700 font-semibold">✅ PDF gerado com sucesso!</span>
                <div className="flex gap-2">
                  <button onClick={() => window.open(pdfCVUrl, '_blank')}
                    className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-50">👁️ Ver</button>
                  <button onClick={() => baixar(pdfCVUrl, `cv-otimizado-${data}.pdf`)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">💾 Baixar</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              {/* Coluna esquerda */}
              <div className="space-y-4">

                {/* Dados pessoais */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">👤 Dados Pessoais</h3>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                    <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={cvEditavel.nome} onChange={e => setCvEditavel({ ...cvEditavel, nome: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Contato</label>
                    <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={cvEditavel.contato} onChange={e => setCvEditavel({ ...cvEditavel, contato: e.target.value })} />
                  </div>
                </div>

                {/* Resumo */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">📝 Resumo Profissional</h3>
                  <textarea rows={6}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    value={cvEditavel.resumo} onChange={e => setCvEditavel({ ...cvEditavel, resumo: e.target.value })} />
                  <p className="text-xs text-gray-400 text-right">{cvEditavel.resumo.length} chars</p>
                </div>

                {/* Habilidades */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">🛠️ Competências</h3>
                  <p className="text-xs text-gray-400">Separe por vírgula</p>
                  <textarea rows={3}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    value={habilidadesTexto} onChange={e => setHabilidadesTexto(e.target.value)} />
                  <div className="flex flex-wrap gap-1">
                    {habilidadesTexto.split(',').map((s, i) => s.trim() && (
                      <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{s.trim()}</span>
                    ))}
                  </div>
                </div>

                {/* Idiomas */}
                {cvEditavel.idiomas.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">🌍 Idiomas</h3>
                    {cvEditavel.idiomas.map((item, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <input className="p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Idioma" value={item.idioma} onChange={e => updIdioma(i, 'idioma', e.target.value)} />
                        <input className="p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Nível" value={item.nivel} onChange={e => updIdioma(i, 'nivel', e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Educação */}
                {cvEditavel.educacao.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">🎓 Formação</h3>
                    {cvEditavel.educacao.map((edu, i) => (
                      <div key={i} className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input className="col-span-2 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Curso" value={edu.curso} onChange={e => updEdu(i, 'curso', e.target.value)} />
                          <input className="p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Ano" value={edu.ano} onChange={e => updEdu(i, 'ano', e.target.value)} />
                        </div>
                        <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Instituição" value={edu.instituicao} onChange={e => updEdu(i, 'instituicao', e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna direita — Experiências */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">💼 Experiências</h3>
                  <button
                    onClick={() => setCvEditavel({ ...cvEditavel, experiencias: [...cvEditavel.experiencias, { cargo: '', empresa: '', periodo: '', descricao: '' }] })}
                    className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                    + Adicionar
                  </button>
                </div>
                {cvEditavel.experiencias.map((exp, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-400">Experiência {i + 1}</span>
                      <button onClick={() => setCvEditavel({ ...cvEditavel, experiencias: cvEditavel.experiencias.filter((_, idx) => idx !== i) })}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">🗑️ Remover</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Cargo" value={exp.cargo} onChange={e => updExp(i, 'cargo', e.target.value)} />
                      <input className="p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Empresa" value={exp.empresa} onChange={e => updExp(i, 'empresa', e.target.value)} />
                    </div>
                    <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Período (ex: Jan 2020 – Presente)" value={exp.periodo} onChange={e => updExp(i, 'periodo', e.target.value)} />
                    <textarea rows={7}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      placeholder="Descrição — cada linha vira um bullet point" value={exp.descricao} onChange={e => updExp(i, 'descricao', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ABA 4 — CARTA
        ════════════════════════════════════════════════════════ */}
        {abaAtiva === 'carta' && (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-800">✉️ Carta de Apresentação</h2>
              <div className="flex gap-2 ml-auto">
                <button onClick={gerarCarta} disabled={gerandoCarta}
                  className="px-3 py-2 border border-blue-200 text-blue-600 rounded-xl text-sm hover:bg-blue-50 disabled:opacity-50 transition-colors">
                  {gerandoCarta ? '⏳...' : '🔄 Nova versão'}
                </button>
                <button onClick={exportarCarta}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                  📄 Exportar PDF
                </button>
              </div>
            </div>

            {cartaAssunto && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl">
                <p className="text-xs text-gray-400 mb-1">📧 Sugestão de assunto para o email:</p>
                <p className="text-sm font-medium text-gray-800">{cartaAssunto}</p>
              </div>
            )}

            {pdfCartaUrl && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between">
                <span className="text-sm text-green-700 font-semibold">✅ Carta exportada!</span>
                <div className="flex gap-2">
                  <button onClick={() => window.open(pdfCartaUrl, '_blank')}
                    className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm">👁️ Ver</button>
                  <button onClick={() => baixar(pdfCartaUrl, `carta-apresentacao-${data}.pdf`)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">💾 Baixar</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              {/* Editor */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">✏️ Editar</h3>
                <textarea
                  className="w-full p-3 border border-gray-100 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono leading-relaxed"
                  rows={26}
                  value={cartaEditada}
                  onChange={e => setCartaEditada(e.target.value)}
                />
                <p className="text-xs text-gray-400 text-right">{cartaEditada.length} chars</p>
              </div>

              {/* Preview */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-5">👁️ Preview</h3>
                <div className="border-b-2 border-blue-500 pb-4 mb-6">
                  <p className="font-bold text-gray-900 text-lg">{cvEditavel?.nome}</p>
                  <p className="text-gray-400 text-xs mt-1">{cvEditavel?.contato}</p>
                </div>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {cartaEditada}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}