// IMPORTACIÓN
import baileys from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

import Pino from 'pino'
import express from 'express'
import fs from 'fs'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 3000
let botConectado = false
let sockInstance = null
let ultimoQR = null

// ==============================
// SERVIDOR WEB MÍNIMO
// ==============================
app.get('/', (req, res) => {
    res.send(`
        <html>
            <body style="text-align:center;padding:50px;">
                <h1>🤖 Bot Pie Consalud</h1>
                <p>Estado: ${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</p>
                ${ultimoQR ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}" />` : ''}
                <p><a href="/test">Test</a> | <a href="/limpiar">Limpiar</a></p>
            </body>
        </html>
    `)
})

app.get('/test', (req, res) => {
    res.json({
        conectado: botConectado,
        user: sockInstance?.user?.id || null
    })
})

app.get('/limpiar', (req, res) => {
    try {
        fs.rmSync('./auth_info', { recursive: true, force: true })
        res.send('Sesión limpiada. Reinicia el bot.')
    } catch (e) {
        res.send('Error: ' + e.message)
    }
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor en puerto', PORT)
    iniciarBot()
})

// ==============================
// BOT MÍNIMO - SIN COMPLICACIONES
// ==============================
async function iniciarBot() {
    console.log('🚀 Iniciando bot mínimo...\n')

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Pie Consalud', 'Chrome', '1.0'],
            printQRInTerminal: true
        })

        sockInstance = sock

        // CONEXIÓN
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                ultimoQR = qr
                botConectado = false
                console.log('\n📲 QR:', `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`)
            }

            if (connection === 'open') {
                console.log('✅ CONECTADO')
                console.log('👤 Usuario:', sock.user?.id)
                botConectado = true
                ultimoQR = null
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode
                console.log('❌ Desconectado:', code)
                botConectado = false
                setTimeout(iniciarBot, 10000)
            }
        })

        // MENSAJES - LO MÁS SIMPLE POSIBLE
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type !== 'notify') return
                
                const msg = messages[0]
                if (!msg.message || msg.key.fromMe) return
                
                const from = msg.key.remoteJid
                if (from.includes('@g.us')) return
                
                // Extraer texto
                const text = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            ''
                
                if (!text) return
                
                console.log('📨', from, '->', text)
                
                // RESPUESTA DIRECTA - SIN DELAYS, SIN COLA
                const respuesta = `👣 *Pie Consalud*\n\nRecibí tu mensaje: "${text}"\n\nResponde:\n1️⃣ Reservar hora\n2️⃣ Precios\n3️⃣ Ubicación\n4️⃣ Abono\n5️⃣ Horarios\n6️⃣ Medios de pago`
                
                // ENVÍO DIRECTO - SIN NADA EXTRA
                await sock.sendMessage(from, { text: respuesta })
                console.log('✅ Enviado a', from)
                
            } catch (error) {
                console.error('❌ Error:', error.message)
            }
        })

        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot mínimo escuchando...')

    } catch (error) {
        console.error('💥 Error:', error)
        setTimeout(iniciarBot, 10000)
    }
}