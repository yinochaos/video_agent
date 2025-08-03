const iconGen = require('icon-gen');
const path = require('path');
const fs = require('fs');

async function createFinalIcons() {
  const publicDir = path.join(__dirname, '../public');
  const baseIconPath = path.join(publicDir, 'icon-1024.png');
  
  console.log('🔧 Creating final icon formats...');
  
  // 检查基础图标是否存在
  if (!fs.existsSync(baseIconPath)) {
    console.error('❌ Base icon not found:', baseIconPath);
    return;
  }

  try {
    // 生成Windows ICO
    console.log('🪟 Generating Windows ICO...');
    await iconGen(baseIconPath, publicDir, {
      ico: {
        name: 'icon',
        sizes: [16, 24, 32, 48, 64, 128, 256]
      }
    });
    console.log('✅ Generated icon.ico');

    // 生成macOS ICNS
    console.log('🍎 Generating macOS ICNS...');
    await iconGen(baseIconPath, publicDir, {
      icns: {
        name: 'icon',
        sizes: [16, 32, 64, 128, 256, 512, 1024]
      }
    });
    console.log('✅ Generated icon.icns');

    console.log('\n🎉 All icon formats created successfully!');
    console.log('📁 Files created in:', publicDir);
    console.log('   - icon.ico (Windows)');
    console.log('   - icon.icns (macOS)');
    console.log('   - Multiple PNG sizes');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
  }
}

createFinalIcons(); 