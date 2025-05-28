// Simple test to verify our TypeScript code compiles and imports work
const { spawn } = require('child_process');

console.log('🔍 Testing TypeScript compilation...');

const tsc = spawn('npx', ['tsc', '--noEmit'], {
  stdio: 'inherit'
});

tsc.on('close', (code) => {
  if (code === 0) {
    console.log('✅ TypeScript compilation successful!');
    console.log('🎉 Project setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up your PostgreSQL database');
    console.log('2. Update the DATABASE_URL in .env file');
    console.log('3. Run: pnpm db:migrate');
    console.log('4. Run: pnpm dev');
  } else {
    console.log('❌ TypeScript compilation failed');
    process.exit(1);
  }
});
