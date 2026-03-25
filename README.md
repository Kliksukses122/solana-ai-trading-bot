# Solana AI Trading Bot

Multi-strategy AI trading bot dengan 6 AI agents untuk Solana.

## 🚀 Deploy ke Render

### Langkah 1: Push ke GitHub

```bash
cd /home/z/my-project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### Langkah 2: Deploy di Render

1. Buka [render.com](https://render.com) dan login
2. Klik **New +** → **Web Service**
3. Connect GitHub repository
4. Setting:
   - **Name**: `solana-ai-trading-bot`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: `Free`
5. Add Environment Variables:
   ```
   TREASURY_PRIVATE_KEY = [your,private,key,array]
   ```
6. Klik **Create Web Service**

### Langkah 3: Tunggu Deploy

- Build akan memakan waktu 2-5 menit
- Setelah selesai, buka URL yang diberikan Render

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TREASURY_PRIVATE_KEY` | Yes* | Private key wallet untuk swap |
| `NEXT_PUBLIC_RPC_ENDPOINT` | No | Solana RPC URL (default: mainnet) |

*Required untuk real trading, tanpa ini hanya bisa paper trading

---

## 🔑 Private Key Format

Untuk `TREASURY_PRIVATE_KEY`, format harus JSON array:

```
[140,76,124,43,12,85,190,219,0,222,146,113,57,194,90,53,223,2,42,241,228,97,41,248,191,40,246,125,141,125,97,184,190,240,50,149,89,91,202,65,194,82,150,179,61,97,250,23,238,213,168,145,159,154,28,62,150,23,36,197,52,54,110,237]
```

### Cara Ambil dari Phantom:
1. Settings → Security & Privacy
2. Export Private Key
3. Masukkan password
4. Copy key tersebut

---

## 📊 Fitur

- ✅ **6 AI Agents** - Scout, Analyst, Risk, Trader, Monitor, Brain
- ✅ **Auto Trading** - Start/Stop dengan satu klik
- ✅ **Risk Management** - Max 3 posisi, 15% daily loss limit
- ✅ **Stop Loss & Take Profit** - Auto monitoring
- ✅ **Token Screening** - Live dari DexScreener

---

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## ⚠️ Risk Warning

Trading cryptocurrency melibatkan risiko tinggi. Hanya gunakan dana yang siap hilang.
