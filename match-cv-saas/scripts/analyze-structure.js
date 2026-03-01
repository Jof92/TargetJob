// scripts/analyze-structure.js
const fs = require('fs');
const path = require('path');

// Configurações
const ROOT = process.cwd();
const IGNORE_FOLDERS = ['node_modules', '.next', '.git', '.vscode', 'dist', 'build', 'coverage'];
const IGNORE_FILES = ['package-lock.json', 'yarn.lock', '.DS_Store', 'Thumbs.db'];
const MAX_DEPTH = 4;
const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  folder: '\x1b[34m',    // Azul
  file: '\x1b[37m',      // Branco
  ts: '\x1b[36m',        // Ciano (TypeScript)
  js: '\x1b[33m',        // Amarelo (JavaScript)
  css: '\x1b[35m',       // Magenta (CSS)
  json: '\x1b[32m',      // Verde (JSON)
  large: '\x1b[31m',     // Vermelho (Arquivos grandes)
  warning: '\x1b[33m',   // Amarelo (Avisos)
  bold: '\x1b[1m'
};

// Estatísticas
const stats = {
  totalFiles: 0,
  totalFolders: 0,
  tsFiles: 0,
  jsFiles: 0,
  totalSize: 0,
  largeFiles: [],
  unusedFiles: [],
  emptyFiles: []
};

function getFileIcon(name, size = 0) {
  if (size > LARGE_FILE_THRESHOLD) return '📦';
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '📘';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return '📙';
  if (name.endsWith('.css') || name.endsWith('.scss')) return '🎨';
  if (name.endsWith('.json')) return '⚙️';
  if (name.endsWith('.md')) return '📝';
  if (name.endsWith('.env')) return '🔐';
  if (name.endsWith('.html')) return '🌐';
  return '📄';
}

function getColor(name, size = 0) {
  if (size > LARGE_FILE_THRESHOLD) return colors.large;
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return colors.ts;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return colors.js;
  if (name.endsWith('.css') || name.endsWith('.scss')) return colors.css;
  if (name.endsWith('.json')) return colors.json;
  return colors.file;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function analyzeFile(filePath, relativePath) {
  try {
    const stat = fs.statSync(filePath);
    const size = stat.size;
    
    stats.totalFiles++;
    stats.totalSize += size;
    
    if (size === 0) {
      stats.emptyFiles.push(relativePath);
    }
    
    if (size > LARGE_FILE_THRESHOLD) {
      stats.largeFiles.push({ path: relativePath, size });
    }
    
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      stats.tsFiles++;
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      stats.jsFiles++;
    }
    
    return { size, isDirectory: false };
  } catch (err) {
    return null;
  }
}

function printTree(dir, prefix = '', depth = 0) {
  if (depth > MAX_DEPTH) {
    console.log(`${prefix}${colors.warning}... (profundidade máxima atingida)${colors.reset}`);
    return;
  }

  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }

  // Filtrar e ordenar
  items = items
    .filter(item => !IGNORE_FOLDERS.includes(item.name) && !IGNORE_FILES.includes(item.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  stats.totalFolders++;

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    
    const relativePath = path.relative(ROOT, path.join(dir, item.name));
    
    if (item.isDirectory()) {
      console.log(`${prefix}${connector}${colors.folder}${colors.bold}📁 ${item.name}${colors.reset}`);
      printTree(path.join(dir, item.name), newPrefix, depth + 1);
    } else {
      const fileInfo = analyzeFile(path.join(dir, item.name), relativePath);
      if (fileInfo) {
        const icon = getFileIcon(item.name, fileInfo.size);
        const color = getColor(item.name, fileInfo.size);
        const sizeStr = fileInfo.size > LARGE_FILE_THRESHOLD ? ` ${colors.warning}[${formatSize(fileInfo.size)}]${colors.reset}` : '';
        console.log(`${prefix}${connector}${color}${icon} ${item.name}${sizeStr}${colors.reset}`);
      }
    }
  });
}

function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log(`${colors.bold}📊 RESUMO DO PROJETO${colors.reset}`);
  console.log('═'.repeat(60));
  
  console.log(`\n${colors.folder}📁 Total de pastas:${colors.reset} ${stats.totalFolders}`);
  console.log(`${colors.file}📄 Total de arquivos:${colors.reset} ${stats.totalFiles}`);
  console.log(`${colors.ts}📘 Arquivos TypeScript:${colors.reset} ${stats.tsFiles}`);
  console.log(`${colors.js}📙 Arquivos JavaScript:${colors.reset} ${stats.jsFiles}`);
  console.log(`${colors.bold}💾 Tamanho total:${colors.reset} ${formatSize(stats.totalSize)}`);
  
  if (stats.largeFiles.length > 0) {
    console.log(`\n${colors.large}⚠️  ARQUIVOS GRANDES (>100KB):${colors.reset}`);
    stats.largeFiles.forEach(file => {
      console.log(`   ${colors.warning}•${colors.reset} ${file.path} ${colors.large}[${formatSize(file.size)}]${colors.reset}`);
    });
  }
  
  if (stats.emptyFiles.length > 0) {
    console.log(`\n${colors.warning}⚠️  ARQUIVOS VAZIOS:${colors.reset}`);
    stats.emptyFiles.forEach(file => {
      console.log(`   ${colors.warning}•${colors.reset} ${file}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`${colors.bold}💡 SUGESTÕES DE LIMPEZA:${colors.reset}`);
  console.log('═'.repeat(60));
  
  console.log('\n1. 🗑️  Delete arquivos vazios listados acima');
  console.log('2. 📦 Revise arquivos grandes (>100KB) - podem ser otimizados');
  console.log('3. 🔍 Verifique arquivos .ts/.tsx não importados em lugar nenhum');
  console.log('4. 🧹 Execute: npm run lint --fix (para auto-correções)');
  console.log('5. 📝 Remova console.logs e comentários desnecessários');
  console.log('6. 🗂️  Organize imports com: npx import-sort --write **/*.ts');
  
  console.log('\n');
}

function findUnusedFiles() {
  console.log(`${colors.warning}🔍 Buscando arquivos não utilizados...${colors.reset}\n`);
  
  // Leitura simples - verifica se o arquivo é importado em algum lugar
  const tsFiles = [];
  
  function collectTsFiles(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !IGNORE_FOLDERS.includes(item.name)) {
          collectTsFiles(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          tsFiles.push(fullPath);
        }
      });
    } catch (err) {
      // Ignora erros
    }
  }
  
  collectTsFiles(ROOT);
  
  console.log(`Encontrados ${tsFiles.length} arquivos TypeScript/TSX`);
  console.log(`${colors.warning}Nota: Verificação completa requer análise de imports (use "depcheck" para isso)${colors.reset}\n`);
}

// Execução principal
console.log('\n' + '═'.repeat(60));
console.log(`${colors.bold}${colors.folder}📂 ESTRUTURA DO PROJETO${colors.reset}`);
console.log(`${colors.warning}Raiz: ${ROOT}${colors.reset}`);
console.log('═'.repeat(60) + '\n');

printTree(ROOT);
printSummary();
findUnusedFiles();

console.log(`${colors.bold}✅ Análise concluída!${colors.reset}\n`);