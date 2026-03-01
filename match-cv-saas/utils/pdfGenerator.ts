// utils/pdfGenerator.ts
import PDFDocument from 'pdfkit';

export interface CVData {
  nome: string;
  contato?: string;
  resumo?: string;
  experiencias: Array<{
    cargo: string;
    empresa: string;
    periodo: string;
    descricao: string;
  }>;
  habilidades: string[];
  educacao?: Array<{
    curso: string;
    instituicao: string;
    ano: string;
  }>;
}

function secao(doc: PDFKit.PDFDocument, titulo: string, marginX: number) {
  doc.moveDown(0.6);
  doc
    .fillColor('#2563eb')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(titulo.toUpperCase(), marginX);
  doc.moveDown(0.2);
  doc
    .moveTo(marginX, doc.y)
    .lineTo(doc.page.width - marginX, doc.y)
    .strokeColor('#93c5fd')
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.4);
}

function renderizarDescricao(
  doc: PDFKit.PDFDocument,
  descricao: string,
  marginX: number,
  larguraUtil: number
) {
  const linhas = descricao
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const linha of linhas) {
    const isBullet = linha.startsWith('•') || linha.startsWith('-');
    const texto = isBullet ? linha.replace(/^[•\-]\s*/, '') : linha;

    if (isBullet) {
      const currentY = doc.y;
      // bullet azul
      doc
        .fillColor('#2563eb')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('•', marginX + 8, currentY, { lineBreak: false });
      // texto do bullet
      doc
        .fillColor('#1f2937')
        .fontSize(10)
        .font('Helvetica')
        .text(texto, marginX + 20, currentY, {
          width: larguraUtil - 20,
          align: 'left',
          lineGap: 1.5,
        });
    } else {
      doc
        .fillColor('#1f2937')
        .fontSize(10)
        .font('Helvetica')
        .text(texto, marginX, doc.y, {
          width: larguraUtil,
          align: 'justify',
          lineGap: 2,
        });
    }
    doc.moveDown(0.2);
  }
}

export async function gerarPDFOtimizado(cvData: CVData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Currículo - ${cvData.nome}`,
          Author: 'MatchCV SaaS',
          Subject: 'Currículo Otimizado',
          CreationDate: new Date(),
        },
        autoFirstPage: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const marginX = 50;
      const larguraUtil = doc.page.width - marginX * 2; // ~495pt

      // ── HEADER ──────────────────────────────────────────────────────
      doc
        .fillColor('#2563eb')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(cvData.nome, marginX, 50, { align: 'center', width: larguraUtil });

      if (cvData.contato) {
        doc.moveDown(0.4);
        doc
          .fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text(cvData.contato, marginX, doc.y, { align: 'center', width: larguraUtil });
      }

      doc.moveDown(0.8);
      doc
        .moveTo(marginX, doc.y)
        .lineTo(doc.page.width - marginX, doc.y)
        .strokeColor('#2563eb')
        .lineWidth(2)
        .stroke();
      doc.moveDown(0.6);

      // ── RESUMO ───────────────────────────────────────────────────────
      if (cvData.resumo?.trim()) {
        secao(doc, 'Resumo Profissional', marginX);
        doc
          .fillColor('#1f2937')
          .fontSize(10)
          .font('Helvetica')
          .text(cvData.resumo, marginX, doc.y, {
            width: larguraUtil,
            align: 'justify',
            lineGap: 3,
          });
      }

      // ── EXPERIÊNCIAS ─────────────────────────────────────────────────
      if (cvData.experiencias.length > 0) {
        secao(doc, 'Experiência Profissional', marginX);

        cvData.experiencias.forEach((exp, idx) => {
          doc
            .fillColor('#111827')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(exp.cargo, marginX, doc.y, { width: larguraUtil });

          doc
            .fillColor('#4b5563')
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text(exp.empresa, marginX, doc.y, { width: larguraUtil });

          doc
            .fillColor('#9ca3af')
            .fontSize(9)
            .font('Helvetica')
            .text(exp.periodo, marginX, doc.y, { width: larguraUtil });

          doc.moveDown(0.3);
          renderizarDescricao(doc, exp.descricao, marginX, larguraUtil);

          if (idx < cvData.experiencias.length - 1) {
            doc.moveDown(0.3);
            doc
              .moveTo(marginX + 20, doc.y)
              .lineTo(doc.page.width - marginX - 20, doc.y)
              .strokeColor('#e5e7eb')
              .lineWidth(0.5)
              .stroke();
            doc.moveDown(0.3);
          }
        });
      }

      // ── HABILIDADES ──────────────────────────────────────────────────
      if (cvData.habilidades.length > 0) {
        secao(doc, 'Competências Técnicas', marginX);

        let tagX = marginX;
        let tagY = doc.y;
        const tagH = 18;
        const tagPad = 10;
        const tagGapH = 6;
        const tagGapV = 7;

        cvData.habilidades.forEach((skill) => {
          const tagW = Math.min(doc.widthOfString(skill) + tagPad * 2, larguraUtil);

          if (tagX + tagW > doc.page.width - marginX) {
            tagX = marginX;
            tagY += tagH + tagGapV;
          }

          doc.roundedRect(tagX, tagY, tagW, tagH, 3).fill('#dbeafe');
          doc
            .fillColor('#1e40af')
            .fontSize(9)
            .font('Helvetica')
            .text(skill, tagX + tagPad, tagY + 4, {
              width: tagW - tagPad * 2,
              lineBreak: false,
            });

          tagX += tagW + tagGapH;
        });

        doc.y = tagY + tagH + 12;
      }

      // ── EDUCAÇÃO ─────────────────────────────────────────────────────
      if (cvData.educacao && cvData.educacao.length > 0) {
        secao(doc, 'Formação Acadêmica', marginX);

        cvData.educacao.forEach((edu) => {
          doc
            .fillColor('#111827')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(edu.curso, marginX, doc.y, { width: larguraUtil });

          doc
            .fillColor('#4b5563')
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text(edu.instituicao, marginX, doc.y, { width: larguraUtil });

          doc
            .fillColor('#9ca3af')
            .fontSize(9)
            .font('Helvetica')
            .text(edu.ano, marginX, doc.y, { width: larguraUtil });

          doc.moveDown(0.5);
        });
      }

      // ── RODAPÉ ───────────────────────────────────────────────────────
      doc
        .fillColor('#d1d5db')
        .fontSize(7.5)
        .font('Helvetica')
        .text(
          `Gerado por MatchCV • ${new Date().toLocaleDateString('pt-BR')}`,
          marginX,
          doc.page.height - 35,
          { align: 'center', width: larguraUtil }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default gerarPDFOtimizado;