const fs = require('fs');
const data = JSON.parse(fs.readFileSync('execution131_data.json', 'utf8'));
data.forEach((item, index) => {
    if (typeof item === 'string' && item.toLowerCase().includes('error')) {
        console.log(`[${index}] ${item}`);
    }
});
