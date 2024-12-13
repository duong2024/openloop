const axios = require('axios');
const fs = require('fs');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { DateTime } = require('luxon');

const proxyList = fs.readFileSync('proxy.txt', 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

const accounts = fs.readFileSync('data.txt', 'utf-8')
    .split('\n')
    .map((line, index) => ({ 
        token: line.trim(), 
        name: `Tài khoản ${index + 1}`,
        proxy: proxyList[index] || null
    }))
    .filter(account => account.token);

async function checkProxyIP(proxy) {
    try {
        const proxyAgent = new HttpsProxyAgent(proxy);
        const response = await axios.get('https://api.ipify.org?format=json', { 
            httpsAgent: proxyAgent,
            timeout: 10000
        });
        
        if (response.status === 200) {
            return response.data.ip;
        } else {
            throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
        }
    } catch (error) {
        throw new Error(`Lỗi khi kiểm tra IP của proxy: ${error.message}`);
    }
}

function getRandomPayload() {
    const quality = Math.floor(Math.random() * (80 - 60 + 1)) + 60;
    return { quality };
}

async function callAPI(account) {
    if (!account.proxy) {
        console.log(
            `${DateTime.now().toISO()} `.gray +  
            `[${account.name}] `.red + 
            `Bỏ qua: Không có proxy`.red
        );
        return;
    }

    const payload = getRandomPayload();
    const authorization = `Bearer ${account.token}`;

    try {
        const proxyIP = await checkProxyIP(account.proxy);
        const proxyAgent = new HttpsProxyAgent(account.proxy);

        const response = await axios.post('https://api.openloop.so/bandwidth/share', payload, {
            httpsAgent: proxyAgent,
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json',
            },
            timeout: 15000 
        });

        const { code, message, data } = response.data;
        if (code === 2000) {
            const balance = data.balances.POINT;
            console.log(
                `${DateTime.now().toISO()} `.gray +  
                `[${account.name}] `.cyan + 
                `[${proxyIP}] `.yellow + 
                `Ping thành công `.green + 
                `| Balance: `.yellow + 
                `${balance}`.green.bold
            );
        } else {
            console.log(
                `${DateTime.now().toISO()} `.gray +  
                `[${account.name}] `.cyan + 
                `[${proxyIP}] `.yellow + 
                `Lỗi: `.red + 
                `${message}`.red
            );
        }
    } catch (error) {
        console.log(
            `${DateTime.now().toISO()} `.gray +  
            `[${account.name}] `.cyan + 
            `Lỗi: `.red + 
            `${error.message}`.red
        );
    }
}

async function callAPIsConcurrently() {
    const tasks = accounts.map(account => callAPI(account)); 
    await Promise.all(tasks); 
}

function startRequestCycle() {
    setInterval(() => {
        callAPIsConcurrently(); 
    }, 3 * 60 * 1000); 
}

console.log('Code đang chạy rồi..vui lòng chờ!');
startRequestCycle();

process.on('uncaughtException', (error) => {
    console.log(
        `${DateTime.now().toISO()} `.gray +  
        `[Hệ thống] `.red + 
        `Lỗi không xác định: `.red + 
        `${error.message}`.red
    );
});
