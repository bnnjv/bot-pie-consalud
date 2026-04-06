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

// Memoria de sesiones (para guardar la sucursal del usuario)
const sesiones = {}

// ==============================
// SERVIDOR WEB
// ==============================
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
                    .qr-img { margin: 20px auto; }
                    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
                </style>
            </head>
            <body>
                <h1>🤖 Bot Pie Consalud</h1>
                <p>Estado: <strong class="${botConectado ? 'conectado' : 'desconectado'}">${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</strong></p>
                ${ultimoQR ? `<div class="qr-img"><img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ultimoQR)}" /></div>` : ''}
                <p><button onclick="location.href='/test'">🔍 Test</button> <button onclick="location.href='/limpiar'">🧹 Limpiar Sesión</button></p>
            </body>
        </html>
    `)
})

app.get('/test', (req, res) => {
    res.json({
        conectado: botConectado,
        user: sockInstance?.user?.id || null,
        sesiones_activas: Object.keys(sesiones).length
    })
})

app.get('/limpiar', async (req, res) => {
    try {
        if (sockInstance && botConectado) {
            await sockInstance.logout()
        }
        fs.rmSync('./auth_info', { recursive: true, force: true })
        res.send('✅ Sesión limpiada. Reinicia el bot.')
    } catch (e) {
        res.send('❌ Error: ' + e.message)
    }
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor en puerto', PORT)
    iniciarBot()
})

// ==============================
// BOT PRINCIPAL
// ==============================
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
                    console.log('⚠️ Sesión cerrada manualmente.')
                } else {
                    console.log('🔄 Reconectando en 10 segundos...')
                    setTimeout(iniciarBot, 10000)
                }
            }
        })

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type !== 'notify') return
                
                const msg = messages[0]
                if (!msg.message || msg.key.fromMe) return
                
                const from = msg.key.remoteJid
                if (from.includes('@g.us')) return
                
                const numero = from.split('@')[0]
                if (!numero.startsWith('569') || numero.length !== 12) {
                    console.log(`⏭️ Ignorando número no chileno: ${numero}`)
                    return
                }
                
                const text = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            ''
                
                if (!text) return
                
                console.log('📨', from, '->', text)
                
                const mensaje = text.toLowerCase().trim()
                let respuesta = ''
                
                // LÓGICA DE RESPUESTAS
                if (mensaje === 'ahumada') {
                    sesiones[from] = { sucursal: 'ahumada' }
                    respuesta = `✅ Has seleccionado la sucursal *Ahumada*.\n\nAhora puedes escribir:\n4️⃣ Para recibir los datos de abono\n1️⃣ Para reservar tu hora`
                }
                else if (mensaje === 'providencia') {
                    sesiones[from] = { sucursal: 'providencia' }
                    respuesta = `✅ Has seleccionado la sucursal *Providencia*.\n\nAhora puedes escribir:\n4️⃣ Para recibir los datos de abono\n1️⃣ Para reservar tu hora`
                }
                else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {
                    respuesta = `📅 *Reserva de Hora*\n\nSelecciona tu sucursal y revisa disponibilidad:\n\n🏙️ Ahumada  \nhttps://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora\n\n🏙️ Providencia  \nhttps://calendly.com/pieconsalud-providencia/reserva-tu-hora\n\n⚠️ Importante: asistir sin esmalte.`
                }
                else if (mensaje === '2' || mensaje.includes('precio') || mensaje.includes('costo')) {
                    respuesta = `💰 *Valores de Atención – Pie Consalud*\n\nAtención Podológica: *$20.000*\n\nTratamientos:\n• Uña encarnada\n• Onicomicosis\n• Pie diabético\n\n*El valor puede variar según evaluación.*`
                }
                else if (mensaje === '3' || mensaje.includes('ubicacion') || mensaje.includes('direccion')) {
                    respuesta = `📍 *Nuestras Sucursales*\n\n🏙️ Ahumada  \nCerca de Metro U. de Chile / Plaza de Armas\n\n🏙️ Providencia  \nCerca de Metro Tobalaba\n\nEscribe "ahumada" o "providencia" para más información.`
                }
                else if (mensaje === '4' || mensaje.includes('abono') || mensaje.includes('transferencia')) {
                    if (!sesiones[from]?.sucursal) {
                        respuesta = `⚠️ Primero selecciona tu sucursal:\n• Ahumada\n• Providencia`
                    }
                    else if (sesiones[from].sucursal === 'ahumada') {
                        respuesta = `💳 *Datos de Abono – Ahumada*\n\nBanco Estado\nCta. Corriente\nN° 29100119011\nRut: 77.478.206-0\nCorreo: Piesalud.21@gmail.com\n\n💰 Abono: *$10.000*`
                    }
                    else {
                        respuesta = `💳 *Datos de Abono – Providencia*\n\nBanco Chile\nCta. Vista\nN° 000083725182\nRut: 77.478.206-0\nCorreo: Pieconsalud@gmail.com\n\n💰 Abono: *$10.000*`
                    }
                }
                else if (mensaje === '5' || mensaje.includes('horario')) {
                    respuesta = `🕒 *Horario de Atención*\n\nLunes a Viernes: 10:00 - 17:00 hrs\nSábados: 10:00 - 12:00 hrs\n*Domingos y festivos: Cerrado*`
                }
                else if (mensaje === '6' || mensaje.includes('pago')) {
                    respuesta = `💳 *Medios de Pago*\n\n✅ Transferencia electrónica\n✅ Efectivo\n\n*El abono de $10.000 es por transferencia al agendar*`
                }
                else {
                    respuesta = `👣 *Pie Consalud - Podología* 👣\n\nResponde con el número:\n\n1️⃣ Reservar hora\n2️⃣ Precios\n3️⃣ Ubicación\n4️⃣ Datos abono\n5️⃣ Horarios\n6️⃣ Medios de pago\n\nEscribe "ahumada" o "providencia" para seleccionar sucursal.`
                }
                
                if (respuesta) {
                    await sock.sendPresenceUpdate('composing', from)
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
                    await sock.sendMessage(from, { text: respuesta })
                    console.log('✅ Enviado a', from)
                }
                
            } catch (error) {
                console.error('❌ Error:', error.message)
            }
        })

        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot listo - Solo números chilenos')

    } catch (error) {
        console.error('💥 Error:', error)
        setTimeout(iniciarBot, 10000)
    }
}