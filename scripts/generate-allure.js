const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const resultsDir = path.resolve(__dirname, '../allure-results');
const reportDir = path.resolve(__dirname, '../allure-report');

console.log('📊 Generating Allure HTML Report...');

if (!fs.existsSync(resultsDir)) {
    console.error('❌ Error: allure-results directory does not exist. Run tests first!');
    process.exit(1);
}

try {
    execSync(`npx allure generate "${resultsDir}" --clean -o "${reportDir}"`, {
        stdio: 'inherit',
    });
    console.log(`✅ Allure report generated successfully at: ${reportDir}`);
} catch (err) {
    console.warn('⚠️ Allure CLI generation encountered an issue:', err.message);
}

