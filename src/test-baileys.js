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
const sesiones = {}

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Bot Pie Consalud</title>
                <meta http-equiv="refresh" content="5">
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .conectado { color: green; }
                    .desconectado { color: red; }
                </style>
            </head>
            <body>
                <h1>🤖 Bot Pie Consalud</h1>
                <p>Estado: <strong class="${botConectado ? 'conectado' : 'desconectado'}">${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</strong></p>
                ${ultimoQR ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ultimoQR)}" />` : ''}
                <p><button onclick="location.href='/test'">🔍 Test</button></p>
            </body>
        </html>
    `)
})

app.get('/test', (req, res) => {
    res.json({ conectado: botConectado, user: sockInstance?.user?.id || null })
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor en puerto', PORT)
    iniciarBot()
})

async function iniciarBot() {
    console.log('🚀 Iniciando bot...\n')

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Pie Consalud', 'Chrome', '1.0'],
            printQRInTerminal: true
        })

        sockInstance = sock

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
                console.log('❌ Desconectado, código:', code)
                botConectado = false
                
                if (code === DisconnectReason.loggedOut) {
                    console.log('⚠️ Sesión cerrada manualmente')
                } else {
                    console.log('🔄 Reconectando en 10 segundos...')
                    setTimeout(iniciarBot, 10000)
                }
            }
        })

        // ==============================
        // MENSAJES - CON FILTRO FLEXIBLE
        // ==============================
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type !== 'notify') return
                
                const msg = messages[0]
                if (!msg.message || msg.key.fromMe) return
                
                const from = msg.key.participant || msg.key.remoteJid
                
                if (from.includes('@g.us')) return
                
                const numero = from.split('@')[0]
                
                console.log('\n📨 Mensaje recibido:')
                console.log('   JID:', from)
                console.log('   Número:', numero)
                
                // 🔥 FILTRO FLEXIBLE (acepta 9, 12 o 13 dígitos)
                const esNumeroValido = numero.length >= 9 && numero.length <= 13
                
                if (!esNumeroValido) {
                    console.log(`   ⏭️ Ignorando (largo inválido: ${numero.length} dígitos)\n`)
                    return
                }
                
                console.log('   ✅ Número aceptado (largo:', numero.length, 'dígitos)')
                
                const text = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            ''
                
                if (!text) {
                    console.log('   ⏭️ Sin texto\n')
                    return
                }
                
                console.log('   📝 Texto:', text)
                
                const mensaje = text.toLowerCase().trim()
                let respuesta = ''
                
                // ===== RESPUESTAS =====
                if (mensaje === 'ahumada') {
                    sesiones[from] = { sucursal: 'ahumada' }
                    respuesta = `✅ Sucursal Ahumada seleccionada\n\n4️⃣ Datos abono\n1️⃣ Reservar hora`
                }
                else if (mensaje === 'providencia') {
                    sesiones[from] = { sucursal: 'providencia' }
                    respuesta = `✅ Sucursal Providencia seleccionada\n\n4️⃣ Datos abono\n1️⃣ Reservar hora`
                }
                else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {
                    respuesta = `📅 *Reserva de Hora*\n\n🏙️ Ahumada: https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora\n🏙️ Providencia: https://calendly.com/pieconsalud-providencia/reserva-tu-hora\n\n⚠️ Asistir sin esmalte`
                }
                else if (mensaje === '2' || mensaje.includes('precio') || mensaje.includes('costo')) {
                    respuesta = `💰 *Valores*\n\nAtención Podológica: *$20.000*\n\n• Uña encarnada\n• Onicomicosis\n• Pie diabético`
                }
                else if (mensaje === '3' || mensaje.includes('ubicacion') || mensaje.includes('direccion')) {
                    respuesta = `📍 *Ubicación*\n\n🏙️ Ahumada: Metro U. de Chile / Plaza de Armas\n🏙️ Providencia: Metro Tobalaba`
                }
                else if (mensaje === '4' || mensaje.includes('abono') || mensaje.includes('transferencia')) {
                    if (!sesiones[from]?.sucursal) {
                        respuesta = `⚠️ Primero escribe tu sucursal:\n• Ahumada\n• Providencia`
                    }
                    else if (sesiones[from].sucursal === 'ahumada') {
                        respuesta = `💳 *Abono - Ahumada*\n\nBanco Estado\nCta. Corriente\nN° 29100119011\nRut: 77.478.206-0\nAbono: *$10.000*`
                    }
                    else {
                        respuesta = `💳 *Abono - Providencia*\n\nBanco Chile\nCta. Vista\nN° 000083725182\nRut: 77.478.206-0\nAbono: *$10.000*`
                    }
                }
                else if (mensaje === '5' || mensaje.includes('horario')) {
                    respuesta = `🕒 *Horarios*\n\nLunes a Viernes: 10:00 - 17:00 hrs\nSábados: 10:00 - 12:00 hrs\nDomingos: Cerrado`
                }
                else if (mensaje === '6' || mensaje.includes('pago')) {
                    respuesta = `💳 *Medios de Pago*\n\n✅ Transferencia\n✅ Efectivo\n\nAbono de $10.000 al agendar`
                }
                else {
                    respuesta = `👣 *Pie Consalud*\n\n1️⃣ Reservar hora\n2️⃣ Precios\n3️⃣ Ubicación\n4️⃣ Datos abono\n5️⃣ Horarios\n6️⃣ Medios de pago\n\nEscribe "ahumada" o "providencia" para seleccionar sucursal`
                }
                
                if (respuesta) {
                    console.log('   📤 Enviando respuesta...')
                    await sock.sendPresenceUpdate('composing', from)
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
                    await sock.sendMessage(from, { text: respuesta })
                    console.log('   ✅ Enviado a', numero)
                    console.log('')
                }
                
            } catch (error) {
                console.error('❌ Error:', error.message)
            }
        })

        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot listo - Filtro flexible (9-13 dígitos)\n')

    } catch (error) {
        console.error('💥 Error:', error)
        setTimeout(iniciarBot, 10000)
    }
}