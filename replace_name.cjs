const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'src', 'pages', 'PrivacyPolicy.jsx'),
  path.join(__dirname, 'src', 'pages', 'TermsOfService.jsx')
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/Uniperq/g, 'Uni Deals');
    content = content.replace(/uniperq\.lk/g, 'unideals.lk');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Reverted ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
