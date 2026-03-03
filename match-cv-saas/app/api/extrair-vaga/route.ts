// app/api/extrair-vaga/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL não informada' }, { status: 400 });
    }

    const isLinkedIn = url.includes('linkedin.com');
    const isJobUrl =
      url.includes('/jobs/') ||
      url.includes('/job/') ||
      url.includes('currentJobId') ||
      url.includes('view/');

    if (!isLinkedIn || !isJobUrl) {
      return NextResponse.json(
        { error: 'Por favor, cole uma URL válida de vaga do LinkedIn (linkedin.com/jobs/...)' },
        { status: 400 }
      );
    }

    console.log('🌐 Iniciando extração da vaga:', url);

    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    });

    try {
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setViewport({ width: 1280, height: 800 });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 20000,
      });

      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 2000));

      // Tenta clicar em "Ver mais" para expandir a descrição
      try {
        const verMaisSelectors = [
          'button.show-more-less-html__button--more',
          '.show-more-less-html__button',
          'button[aria-label*="more"]',
        ];
        for (const selector of verMaisSelectors) {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            await new Promise((r) => setTimeout(r, 1000));
            break;
          }
        }
      } catch {
        // Ignora se não encontrar
      }

      const textoVaga = await page.evaluate(() => {
        const selectors = [
          '.jobs-description__content',
          '.jobs-description-content__text',
          '.show-more-less-html__markup',
          '[class*="job-description"]',
          '[class*="description__text"]',
          '.jobs-box__html-content',
          'article',
          'main',
        ];

        let textoFinal = '';

        const titulo = document.querySelector('h1')?.textContent || '';
        const empresa =
          document.querySelector('[class*="company-name"]')?.textContent ||
          document.querySelector('[class*="topcard__org-name"]')?.textContent || '';
        const local =
          document.querySelector('[class*="topcard__flavor--bullet"]')?.textContent ||
          document.querySelector('[class*="location"]')?.textContent || '';

        if (titulo) textoFinal += `Cargo: ${titulo.trim()}\n`;
        if (empresa) textoFinal += `Empresa: ${empresa.trim()}\n`;
        if (local) textoFinal += `Local: ${local.trim()}\n\n`;

        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 100) {
            textoFinal += el.textContent.trim();
            break;
          }
        }

        if (textoFinal.length < 100) {
          textoFinal = document.body.innerText || '';
        }

        return textoFinal;
      });

      await browser.close();

      if (!textoVaga || textoVaga.trim().length < 50) {
        return NextResponse.json(
          {
            error: 'Não foi possível extrair o conteúdo. O LinkedIn pode ter bloqueado. Cole o texto manualmente.',
            bloqueado: true,
          },
          { status: 422 }
        );
      }

      const textoLimpo = textoVaga
        .replace(/\n{4,}/g, '\n\n')
        .replace(/\t/g, ' ')
        .replace(/ {3,}/g, ' ')
        .trim()
        .substring(0, 8000);

      console.log('✅ Vaga extraída, tamanho:', textoLimpo.length);
      return NextResponse.json({ textoVaga: textoLimpo });

    } catch (pageError: any) {
      await browser.close();
      throw pageError;
    }

  } catch (error: any) {
    console.error('💥 Erro ao extrair vaga:', error?.message);
    const bloqueado =
      error?.message?.includes('timeout') ||
      error?.message?.includes('Navigation') ||
      error?.message?.includes('net::');

    return NextResponse.json(
      {
        error: bloqueado
          ? 'O LinkedIn bloqueou ou a página demorou muito. Cole o texto manualmente.'
          : error?.message || 'Erro ao extrair vaga',
        bloqueado,
      },
      { status: 500 }
    );
  }
}