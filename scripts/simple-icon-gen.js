const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createBaseIcon() {
  const publicDir = path.join(__dirname, '../public');
  
  // 确保public目录存在
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('🎨 Creating Vursor icon...');

  // 创建一个基础的Canvas风格图标
  const svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <circle cx="128" cy="128" r="120" fill="#1a1a2e" stroke="#2563eb" stroke-width="6"/>
  
  <!-- Video Screen -->
  <rect x="60" y="80" width="136" height="96" rx="12" fill="#0f172a" stroke="#374151" stroke-width="3"/>
  
  <!-- Play Button -->
  <polygon points="100,110 100,146 130,128" fill="#10b981"/>
  
  <!-- Timeline -->
  <rect x="60" y="190" width="136" height="16" rx="8" fill="#374151"/>
  
  <!-- Timeline Clips -->
  <rect x="65" y="193" width="25" height="10" rx="3" fill="#3b82f6"/>
  <rect x="95" y="193" width="35" height="10" rx="3" fill="#8b5cf6"/>
  <rect x="135" y="193" width="20" height="10" rx="3" fill="#f59e0b"/>
  <rect x="160" y="193" width="30" height="10" rx="3" fill="#ef4444"/>
  
  <!-- Cursor -->
  <g transform="translate(150, 100)">
    <polygon points="0,0 0,20 6,14 12,20 14,18 8,12 14,12 0,0" fill="#ffffff" stroke="#000000" stroke-width="1"/>
    <polygon points="2,2 2,16 6,12 10,16 12,14 8,10 12,10 2,2" fill="#10b981"/>
  </g>
  
  <!-- Highlight ring -->
  <circle cx="128" cy="128" r="115" fill="none" stroke="#10b981" stroke-width="2" opacity="0.8"/>
</svg>`;

  // 保存SVG文件
  fs.writeFileSync(path.join(publicDir, 'vursor-icon.svg'), svg);
  console.log('✅ Created SVG icon');

  // 生成不同尺寸的PNG
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  
  for (const size of sizes) {
    try {
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `icon-${size}.png`));
      console.log(`✅ Generated ${size}x${size} PNG`);
    } catch (error) {
      console.error(`❌ Error generating ${size}x${size} PNG:`, error.message);
    }
  }

  // 创建主要文件
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'icon.png'));

  await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  // 替换默认图标
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'electron-vite.svg'));

  console.log('✅ Generated main icons');
  console.log('🎉 Icon generation complete!');
}

createBaseIcon().catch(console.error); 