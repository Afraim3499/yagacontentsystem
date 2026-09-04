const puppeteer = require('puppeteer');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8446355677:AAGln29V9MXOifeJc5NBZT0Dn68Z8innrQw';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function extractNumbers(str) {
    if (!str) return [];
    const matches = str.match(/\d+(\.\d+)?/g);
    return matches ? matches.map(Number) : [];
}

function parseSignalForChart(parsed) {
    const symbol = (parsed.symbol || 'CRYPTO').replace('$', '').toUpperCase();
    const entryNums = extractNumbers(parsed.entry);
    const tpNums = extractNumbers(parsed.tp);
    const slNums = extractNumbers(parsed.sl);

    if (entryNums.length === 0 || tpNums.length === 0 || slNums.length === 0) {
        return null;
    }

    const e = entryNums[0];
    const sl = slNums[0];

    let tp1 = tpNums[0];
    let tp2 = tpNums.length > 1 ? tpNums[1] : (tp1 > e ? tp1 * 1.03 : tp1 * 0.97);
    let tp3 = tpNums.length > 2 ? tpNums[2] : (tp1 > e ? tp1 * 1.06 : tp1 * 0.94);

    const precision = e.toString().includes('.') ? e.toString().split('.')[1].length : 2;
    tp1 = Number(tp1.toFixed(precision));
    tp2 = Number(tp2.toFixed(precision));
    tp3 = Number(tp3.toFixed(precision));

    const dir = tp1 >= e ? 'LONG' : 'SHORT';
    const lev = parsed.leverage || '1X-3X';

    return { symbol, dir, e, sl, tp1, tp2, tp3, lev };
}

async function renderSignalChartBuffer(params) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

        const query = new URLSearchParams({
            symbol: params.symbol,
            pair: `${params.symbol}USDT`,
            dir: params.dir,
            e: params.e.toString(),
            sl: params.sl.toString(),
            tp1: params.tp1.toString(),
            tp2: params.tp2.toString(),
            tp3: params.tp3.toString(),
            lev: params.lev,
            hideButtons: 'true'
        });

        const targetUrl = `http://localhost:3000/signal-studio?${query.toString()}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        const cardElement = await page.$('#signal-capture-card');
        if (!cardElement) throw new Error("Card element #signal-capture-card not found");

        const imageBuffer = await cardElement.screenshot({ type: 'png' });
        return imageBuffer;
    } catch (err) {
        console.error("Failed to render chart image:", err.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

async function sendPhotoBuffer(chatId, buffer, caption, extraPayload = {}) {
    try {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', caption || '');
        formData.append('parse_mode', extraPayload.parse_mode || 'Markdown');
        
        if (extraPayload.reply_markup) {
            formData.append('reply_markup', typeof extraPayload.reply_markup === 'string' 
                ? extraPayload.reply_markup 
                : JSON.stringify(extraPayload.reply_markup));
        }

        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append('photo', blob, 'chart_signal.png');

        const res = await fetch(`${API_BASE}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    } catch (err) {
        console.error('sendPhotoBuffer Telegram Error:', err.message);
        return { ok: false };
    }
}

module.exports = {
    parseSignalForChart,
    renderSignalChartBuffer,
    sendPhotoBuffer
};
