// IMPORTACIÓN CORRECTA para Baileys 6.5.0
import baileys from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

import Pino from 'pino'
import express from 'express'
import fs from 'fs'
import path from 'path'

const sesiones = {}
const app = express()
const PORT = process.env.PORT || 3000

// Estado del bot
let botConectado = false
let sockInstance = null
let ultimoQR = null

// ==============================
// SERVIDOR WEB (tu código original mejorado)
// ==============================

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Bot Pie Consalud</title>
                <meta http-equiv="refresh" content="10">
                <style>
                    body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                    .container { max-width: 800px; margin: 0 auto; }
                    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .online { color: green; font-weight: bold; }
                    .offline { color: red; font-weight: bold; }
                    .qr-img { max-width: 300px; margin: 20px auto; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h1>🤖 Bot Pie Consalud</h1>
                        <p>Estado: <span class="${botConectado ? 'online' : 'offline'}">${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</span></p>
                        <p>📊 Sesiones activas: ${Object.keys(sesiones).length}</p>
                    </div>
                    
                    ${!botConectado && ultimoQR ? `
                        <div class="card">
                            <h3>📲 QR PARA CONECTAR</h3>
                            <div class="qr-img">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}" />
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="card">
                        <h3>🔧 ACCIONES</h3>
                        <button onclick="location.href='/test'">🔍 Diagnosticar</button>
                    </div>
                </div>
            </body>
        </html>
    `)
})

app.get('/test', (req, res) => {
    res.json({
        estado: botConectado ? 'conectado' : 'desconectado',
        sesiones_activas: Object.keys(sesiones).length,
        sock_exists: !!sockInstance,
        user: sockInstance?.user || null,
        timestamp: new Date().toISOString()
    })
})

app.get('/qr', (req, res) => {
    if (ultimoQR) {
        res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}`)
    } else {
        res.send('No hay QR disponible')
    }
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor web activo en puerto', PORT)
    iniciarBaileys()
})

// ==============================
// FUNCIÓN PRINCIPAL DEL BOT (CORREGIDA)
// ==============================

async function iniciarBaileys() {
    console.log('🚀 Bot de Pie Consalud iniciado...\n')

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Pie Consalud Bot', 'Chrome', '1.0'],
            printQRInTerminal: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000
        })
        
        sockInstance = sock

        // ==============================
        // CONEXIÓN
        // ==============================

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                ultimoQR = qr
                botConectado = false
                const link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
                console.log('\n📲 ESCANEA ESTE QR PARA VINCULAR PIE CONSALUD:')
                console.log(link + '\n')
            }

            if (connection === 'open') {
                console.log('✅ WhatsApp conectado correctamente')
                console.log('👤 Usuario:', sock.user?.id)
                botConectado = true
                ultimoQR = null
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode
                console.log('❌ Conexión cerrada, código:', reason)
                botConectado = false
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reintentando conexión en 5 segundos...')
                    setTimeout(iniciarBaileys, 5000)
                } else {
                    console.log('⚠️ Sesión cerrada. Se generará nuevo QR...')
                    ultimoQR = null
                    setTimeout(iniciarBaileys, 5000)
                }
            }
        })

        // ==============================
        // MENSAJES - CORREGIDO CON SUGERENCIAS DE CHATGPT
        // ==============================

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                // 🔴 FILTRO CRÍTICO #1: Solo mensajes nuevos
                if (type !== 'notify') {
                    console.log('⏭️ Evento ignorado (tipo:', type, ')')
                    return
                }

                const msg = messages[0]
                
                // Ignorar mensajes propios
                if (!msg.message || msg.key.fromMe) {
                    console.log('⏭️ Ignorando mensaje propio o vacío')
                    return
                }

                const from = msg.key.remoteJid
                
                // 🔴 FILTRO CRÍTICO #2: Solo chats privados
                if (from.includes('@g.us')) {
                    console.log('⏭️ Ignorando mensaje de grupo:', from)
                    return
                }

                // 🔴 CORRECCIÓN #3: Capturar TODOS los tipos de mensaje
                const text = 
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    ''

                console.log('📨 Mensaje recibido de:', from)
                console.log('📨 Contenido:', text)

                if (!text) {
                    console.log('⏭️ Mensaje sin texto, ignorando')
                    return
                }

                const mensaje = text.toLowerCase().trim()
                let respuesta = ''

                // ===== TU CÓDIGO ORIGINAL DE RESPUESTAS =====
                // (exactamente igual a como lo tenías)

                if (mensaje === 'ahumada') {
                    sesiones[from] = { sucursal: 'ahumada' }
                    respuesta = 
`✅ Has seleccionado la sucursal *Ahumada*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
                }

                else if (mensaje === 'providencia') {
                    sesiones[from] = { sucursal: 'providencia' }
                    respuesta = 
`✅ Has seleccionado la sucursal *Providencia*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
                }

                else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {
                    respuesta = 
`📅 *Reserva de Hora*

Selecciona tu sucursal y revisa disponibilidad:

🏙️ Ahumada  
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

🏙️ Providencia  
https://calendly.com/pieconsalud-providencia/reserva-tu-hora

⚠️ Importante: asistir sin esmalte.`
                }

                else if (mensaje === '2' || mensaje.includes('precio')) {
                    respuesta = 
`🏷️ *Valores de Atención – Pie Consalud*

Atención Podológica: *$20.000*

Tratamientos como:
• Uña encarnada
• Onicomicosis
• Pie diabético

El valor puede variar según evaluación profesional.`
                }

                else if (mensaje === '3' || mensaje.includes('direccion') || mensaje.includes('ubicacion')) {
                    respuesta = 
`📍 *Nuestras Sucursales*

🏙️ Ahumada  
Cerca de Metro U. de Chile / Plaza de Armas

🏙️ Providencia  
Cerca de Metro Tobalaba

Escribe el nombre de la sucursal para continuar.`
                }

                else if (mensaje === '4' || mensaje.includes('abono')) {
                    if (!sesiones[from]?.sucursal) {
                        respuesta = 
`Para enviarte los datos de abono, primero indícanos la sucursal:

• Ahumada
• Providencia`
                    }
                    else if (sesiones[from].sucursal === 'ahumada') {
                        respuesta = 
`💳 *Datos de Abono – Sucursal Ahumada*

Banco Estado
Cuenta Corriente
N° 29100119011
Rut: 77.478.206-0
Correo: Piesalud.21@gmail.com

Abono: *$10.000*
Se descuenta del total de la atención.`
                    }
                    else {
                        respuesta = 
`💳 *Datos de Abono – Sucursal Providencia*

Banco Chile
Cuenta Vista
N° 000083725182
Rut: 77.478.206-0
Correo: Pieconsalud@gmail.com

Abono: *$10.000*
Se descuenta del total de la atención.`
                    }
                }

                else if (mensaje === '5' || mensaje.includes('horario')) {
                    respuesta = 
`🕒 *Horario de Atención*

Lunes a viernes
10:00 a 17:00 hrs

Sábados
10:00 a 12:00 hrs`
                }

                else if (mensaje === '6' || mensaje.includes('pago')) {
                    respuesta = 
`💰 *Medios de Pago*

✔️ Transferencia electrónica
✔️ Efectivo

El abono de $10.000 se realiza vía transferencia al momento de agendar.`
                }

                else {
                    respuesta = 
`👣 *¡Hola! Bienvenido/a a Pie Consalud* 👣

Por favor selecciona una opción:

1️⃣ Reservar una hora
2️⃣ Ver precios
3️⃣ Ubicación
4️⃣ Datos para abono
5️⃣ Horarios
6️⃣ Medios de pago`
                }

                // Enviar respuesta
                if (respuesta) {
                    console.log('📤 Enviando respuesta a:', from)
                    await sock.sendMessage(from, { text: respuesta })
                    console.log('✅ Respuesta enviada')
                }

            } catch (error) {
                console.error('❌ Error procesando mensaje:', error)
            }
        })

        // Guardar credenciales
        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot escuchando mensajes...')

    } catch (error) {
        console.error('💥 Error iniciando bot:', error)
        setTimeout(iniciarBaileys, 5000)
    }
}