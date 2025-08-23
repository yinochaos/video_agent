const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

// 工作目录设置为项目根目录
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

// 显示标题
console.log(chalk.green('======================================='));
console.log(chalk.green('     Vursor Windows 应用构建工具      '));
console.log(chalk.green('======================================='));
console.log();

// 检查环境
function checkEnvironment() {
  const spinner = ora('检查环境...').start();
  
  try {
    // 检查Node.js
    const nodeVersion = execSync('node -v').toString().trim();
    // 检查npm
    const npmVersion = execSync('npm -v').toString().trim();
    
    spinner.succeed(`环境检查通过: Node.js ${nodeVersion}, npm ${npmVersion}`);
    return true;
  } catch (error) {
    spinner.fail('环境检查失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 安装依赖
function installDependencies() {
  const spinner = ora('安装项目依赖...').start();
  
  try {
    execSync('npm install', { stdio: 'pipe' });
    spinner.succeed('依赖安装完成');
    return true;
  } catch (error) {
    spinner.fail('依赖安装失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 清理旧的构建文件
function cleanBuildFiles() {
  const spinner = ora('清理旧的构建文件...').start();
  
  try {
    if (fs.existsSync('dist')) {
      rimraf.sync('dist');
    }
    if (fs.existsSync('release')) {
      rimraf.sync('release');
    }
    spinner.succeed('清理完成');
    return true;
  } catch (error) {
    spinner.fail('清理失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 生成图标
function generateIcons() {
  const spinner = ora('生成应用图标...').start();
  
  try {
    if (fs.existsSync('scripts/generate-icons.js')) {
      execSync('npm run generate-icons', { stdio: 'pipe' });
      spinner.succeed('图标生成完成');
    } else {
      spinner.warn('图标生成脚本不存在，跳过此步骤');
    }
    return true;
  } catch (error) {
    spinner.warn('图标生成失败，但将继续构建');
    return true;
  }
}

// 构建前端代码
function buildFrontend() {
  const spinner = ora('构建React前端代码...').start();
  
  try {
    execSync('npm run build', { stdio: 'pipe' });
    spinner.succeed('前端构建完成');
    return true;
  } catch (error) {
    spinner.fail('前端构建失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 构建Electron应用
function buildElectron() {
  const spinner = ora('构建Electron Windows应用...').start();
  
  try {
    execSync('npx electron-builder --win --x64', { stdio: 'pipe' });
    spinner.succeed('Electron构建完成');
    return true;
  } catch (error) {
    spinner.fail('Electron构建失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 检查构建结果
function checkBuildResults() {
  const spinner = ora('检查构建结果...').start();
  
  try {
    if (fs.existsSync('release')) {
      // 查找Windows可执行文件
      const files = fs.readdirSync('release');
      const winFiles = files.filter(file => 
        file.endsWith('.exe') || 
        file.includes('portable') || 
        file.endsWith('.msi') || 
        file.endsWith('.appx')
      );
      
      if (winFiles.length > 0) {
        spinner.succeed('构建成功!');
        console.log(chalk.green('Windows应用程序已创建:'));
        winFiles.forEach(file => {
          const stats = fs.statSync(path.join('release', file));
          const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`  - ${chalk.cyan(file)} (${fileSizeMB} MB)`);
        });
        return true;
      } else {
        spinner.warn('未找到Windows可执行文件，请检查release目录');
        return false;
      }
    } else {
      spinner.fail('构建失败，release目录不存在');
      return false;
    }
  } catch (error) {
    spinner.fail('检查构建结果失败');
    console.error(chalk.red(`错误: ${error.message}`));
    return false;
  }
}

// 主函数
async function main() {
  console.log(chalk.yellow('开始构建Windows应用程序...\n'));
  
  const steps = [
    { name: '检查环境', func: checkEnvironment },
    { name: '安装依赖', func: installDependencies },
    { name: '清理旧的构建文件', func: cleanBuildFiles },
    { name: '生成图标', func: generateIcons },
    { name: '构建前端代码', func: buildFrontend },
    { name: '构建Electron应用', func: buildElectron },
    { name: '检查构建结果', func: checkBuildResults }
  ];
  
  let success = true;
  
  for (const step of steps) {
    console.log(chalk.blue(`\n[${steps.indexOf(step) + 1}/${steps.length}] ${step.name}`));
    const result = await step.func();
    if (!result) {
      success = false;
      break;
    }
  }
  
  console.log('\n');
  if (success) {
    console.log(chalk.green('======================================='));
    console.log(chalk.green('     构建完成!                         '));
    console.log(chalk.green('======================================='));
  } else {
    console.log(chalk.red('======================================='));
    console.log(chalk.red('     构建失败!                         '));
    console.log(chalk.red('======================================='));
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error(chalk.red(`致命错误: ${error.message}`));
  process.exit(1);
});