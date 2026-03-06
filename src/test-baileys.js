// IMPORTACIÓN CORREGIDA para Baileys 6.5.0
import baileys from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

import Pino from 'pino'
import express from 'express'

const sesiones = {}
const app = express()
const PORT = process.env.PORT || 3000

// Variable para verificar si el bot está conectado
let botConectado = false
let sockInstance = null

// ==============================
// SERVIDOR WEB PARA RAILWAY
// ==============================

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🤖 Bot Pie Consalud</h1>
                <p>Estado: <strong>${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</strong></p>
                <p>💬 El bot debería responder mensajes</p>
                <p><a href="/qr">Ver QR</a> | <a href="/test">Testear bot</a></p>
            </body>
        </html>
    `)
})

app.get('/test', (req, res) => {
    res.json({
        estado: botConectado ? 'conectado' : 'desconectado',
        sesiones_activas: Object.keys(sesiones).length,
        sock_exists: !!sockInstance,
        timestamp: new Date().toISOString()
    })
})

app.get('/qr', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>QR Bot Pie Consalud</title>
                <meta http-equiv="refresh" content="5">
                <style>
                    body { 
                        font-family: Arial; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                    }
                    .container {
                        background: rgba(255, 255, 255, 0.95);
                        padding: 2rem;
                        border-radius: 10px;
                        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                        color: #333;
                    }
                    .qr-img {
                        margin: 20px 0;
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 Pie Consalud Bot</h1>
                    ${global.ultimoQR ? 
                        `<div class="qr-img">
                            <h3>📲 Escanea este QR con WhatsApp</h3>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(global.ultimoQR)}" />
                            <p>El QR se actualiza automáticamente si expira</p>
                        </div>` : 
                        botConectado ? 
                            '<h3>✅ Bot ya está conectado!</h3>' :
                            '<h3>⏳ Generando QR, espera unos segundos...</h3>'
                    }
                </div>
            </body>
        </html>
    `)
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor web activo en puerto', PORT)
    console.log('📱 Para ver el QR, visita /qr')
    console.log('🔍 Para testear, visita /test')
    iniciarBaileys()
})

async function iniciarBaileys() {
    console.log('🚀 Bot de Pie Consalud iniciado...\n')

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
            global.ultimoQR = qr
            botConectado = false
            const link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
            console.log('\n📲 ESCANEA ESTE QR PARA VINCULAR PIE CONSALUD:')
            console.log(link + '\n')
            if (process.env.RAILWAY_PUBLIC_DOMAIN) {
                console.log('📱 O visita: https://' + process.env.RAILWAY_PUBLIC_DOMAIN + '/qr')
            }
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado correctamente')
            botConectado = true
            global.ultimoQR = null
            console.log('💬 El bot ya puede recibir y responder mensajes')
            console.log('📊 Sesiones activas:', Object.keys(sesiones).length)
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
                global.ultimoQR = null
                setTimeout(iniciarBaileys, 5000)
            }
        }
    })

    // ==============================
    // MENSAJES - CON DEBUG
    // ==============================

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log('📨 Evento messages.upsert recibido. Tipo:', type)
        console.log('📨 Cantidad de mensajes:', messages.length)
        
        const msg = messages[0]
        
        // Log completo del mensaje para debug
        console.log('📨 Mensaje completo:', JSON.stringify({
            key: msg.key,
            messageType: msg.message ? Object.keys(msg.message) : 'sin mensaje',
            fromMe: msg.key.fromMe,
            pushName: msg.pushName
        }, null, 2))
        
        // Ignorar mensajes propios
        if (!msg.message || msg.key.fromMe) {
            console.log('⏭️ Ignorando mensaje propio o sin contenido')
            return
        }

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            ''

        console.log('📨 Mensaje recibido de:', from)
        console.log('📨 Contenido:', text)
        console.log('📨 ¿Tiene sesión previa?', !!sesiones[from])

        if (!text) {
            console.log('⏭️ Mensaje sin texto, ignorando')
            return
        }

        const mensaje = text.toLowerCase().trim()
        let respuesta = ''

        // ===== SELECCIÓN SUCURSAL =====

        if (mensaje === 'ahumada') {
            sesiones[from] = { sucursal: 'ahumada' }
            respuesta =
`✅ Has seleccionado la sucursal *Ahumada*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
            console.log('✅ Sucursal Ahumada seleccionada para:', from)
        }

        else if (mensaje === 'providencia') {
            sesiones[from] = { sucursal: 'providencia' }
            respuesta =
`✅ Has seleccionado la sucursal *Providencia*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
            console.log('✅ Sucursal Providencia seleccionada para:', from)
        }

        // ===== 1 RESERVA =====

        else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {
            respuesta =
`📅 *Reserva de Hora*

Selecciona tu sucursal y revisa disponibilidad:

🏙️ Ahumada  
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

🏙️ Providencia  
https://calendly.com/pieconsalud-providencia/reserva-tu-hora

⚠️ Importante: asistir sin esmalte.`
            console.log('✅ Enviando info de reserva a:', from)
        }

        // ===== 2 PRECIOS =====

        else if (mensaje === '2' || mensaje.includes('precio')) {
            respuesta =
`🏷️ *Valores de Atención – Pie Consalud*

Atención Podológica: *$20.000*

Tratamientos como:
• Uña encarnada
• Onicomicosis
• Pie diabético

El valor puede variar según evaluación profesional.`
            console.log('✅ Enviando precios a:', from)
        }

        // ===== 3 UBICACIÓN =====

        else if (mensaje === '3' || mensaje.includes('direccion') || mensaje.includes('ubicacion')) {
            respuesta =
`📍 *Nuestras Sucursales*

🏙️ Ahumada  
Cerca de Metro U. de Chile / Plaza de Armas

🏙️ Providencia  
Cerca de Metro Tobalaba

Escribe el nombre de la sucursal para continuar.`
            console.log('✅ Enviando ubicaciones a:', from)
        }

        // ===== 4 ABONO =====

        else if (mensaje === '4' || mensaje.includes('abono')) {

            if (!sesiones[from]?.sucursal) {
                respuesta =
`Para enviarte los datos de abono, primero indícanos la sucursal:

• Ahumada
• Providencia`
                console.log('⚠️ Usuario sin sucursal seleccionada')
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
                console.log('✅ Enviando datos abono Ahumada a:', from)
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
                console.log('✅ Enviando datos abono Providencia a:', from)
            }
        }

        // ===== 5 HORARIOS =====

        else if (mensaje === '5' || mensaje.includes('horario')) {
            respuesta =
`🕒 *Horario de Atención*

Lunes a viernes
10:00 a 17:00 hrs

Sábados
10:00 a 12:00 hrs`
            console.log('✅ Enviando horarios a:', from)
        }

        // ===== 6 MEDIOS DE PAGO =====

        else if (mensaje === '6' || mensaje.includes('pago')) {
            respuesta =
`💰 *Medios de Pago*

✔️ Transferencia electrónica
✔️ Efectivo

El abono de $10.000 se realiza vía transferencia al momento de agendar.`
            console.log('✅ Enviando medios de pago a:', from)
        }

        // ===== MENÚ PRINCIPAL =====

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
            console.log('✅ Enviando menú principal a:', from)
        }

        try {
            console.log('📤 Enviando respuesta a:', from)
            await sock.sendMessage(from, { text: respuesta })
            console.log('✅ Respuesta enviada correctamente')
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error)
        }
    })

    sock.ev.on('creds.update', saveCreds)
    
    // Evento para detectar cuando se reciben mensajes (cualquier tipo)
    sock.ev.on('messages.update', (update) => {
        console.log('📨 messages.update:', update)
    })
    
    console.log('🎧 Bot escuchando mensajes...')
}