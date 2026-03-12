// IMPORTACIÓN CORRECTA para Baileys 6.5.0
import baileys from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys

import Pino from 'pino'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sesiones = {}
const app = express()
const PORT = process.env.PORT || 3000

// Estado del bot
let botConectado = false
let sockInstance = null
let ultimoQR = null

// ==============================
// CONFIGURACIÓN DE SEGURIDAD ANTI-BAN
// ==============================

const SEGURIDAD = {
    mensajesPorMinuto: 0,
    ultimoReset: Date.now(),
    maxPorMinuto: 8,
    conversaciones: new Map(),
    
    puedeEnviar: function(from) {
        if (Date.now() - this.ultimoReset > 60000) {
            this.mensajesPorMinuto = 0
            this.ultimoReset = Date.now()
        }
        
        if (this.mensajesPorMinuto >= this.maxPorMinuto) {
            console.log('⚠️ Límite de mensajes por minuto alcanzado')
            return false
        }
        
        const ultimoMensaje = this.conversaciones.get(from) || 0
        if (Date.now() - ultimoMensaje < 10000) {
            console.log('⚠️ Enviando mensajes muy rápido al mismo usuario')
            return false
        }
        
        return true
    },
    
    registrarEnvio: function(from) {
        this.mensajesPorMinuto++
        this.conversaciones.set(from, Date.now())
    }
}

// ==============================
// SERVIDOR WEB
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
                    button { padding: 10px 20px; margin: 5px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
                    button:hover { background: #45a049; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h1>🤖 Bot Pie Consalud - MODO HUMANO</h1>
                        <p>Estado: <span class="${botConectado ? 'online' : 'offline'}">${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</span></p>
                        <p>📊 Sesiones activas: ${Object.keys(sesiones).length}</p>
                        <p>⏱️ Mensajes/minuto: ${SEGURIDAD.mensajesPorMinuto}/${SEGURIDAD.maxPorMinuto}</p>
                    </div>
                    
                    ${!botConectado && ultimoQR ? `
                        <div class="card">
                            <h3>📲 QR PARA CONECTAR</h3>
                            <div class="qr-img">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}" />
                            </div>
                            <p>⚠️ El QR expira en 20 segundos. Ten el teléfono listo!</p>
                        </div>
                    ` : ''}
                    
                    <div class="card">
                        <h3>🔧 ACCIONES</h3>
                        <button onclick="location.href='/test'">🔍 Diagnosticar</button>
                        <button onclick="location.href='/limpiar'">🧹 Limpiar Sesión</button>
                        <button onclick="location.href='/reiniciar'">🔄 Reiniciar Bot</button>
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
        seguridad: {
            mensajesPorMinuto: SEGURIDAD.mensajesPorMinuto,
            maxPorMinuto: SEGURIDAD.maxPorMinuto,
            conversacionesActivas: SEGURIDAD.conversaciones.size
        },
        timestamp: new Date().toISOString()
    })
})

app.get('/limpiar', (req, res) => {
    try {
        const authPath = path.join(process.cwd(), 'auth_info')
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true })
        }
        res.send('🧹 Sesión limpiada. El bot se reiniciará automáticamente.')
        setTimeout(() => process.exit(0), 2000)
    } catch (error) {
        res.send('❌ Error al limpiar: ' + error.message)
    }
})

app.get('/reiniciar', (req, res) => {
    res.send('🔄 Reiniciando bot...')
    setTimeout(() => process.exit(0), 2000)
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
    console.log('📱 Panel de control: /')
    console.log('🔍 Diagnóstico: /test')
    console.log('🧹 Limpiar sesión: /limpiar')
    console.log('🔄 Reiniciar: /reiniciar')
})

// ==============================
// FUNCIÓN DE LIMPIEZA PROFUNDA
// ==============================

function limpiezaProfunda() {
    console.log('🧹 Limpieza profunda de sesión...')
    const carpetas = [
        './auth_info',
        './auth_info_baileys',
        './session',
        './.auth'
    ]
    
    carpetas.forEach(carpeta => {
        try {
            if (fs.existsSync(carpeta)) {
                fs.rmSync(carpeta, { recursive: true, force: true })
                console.log(`✅ Eliminada: ${carpeta}`)
            }
        } catch (e) {
            console.log(`⚠️ No se pudo eliminar ${carpeta}:`, e.message)
        }
    })
}

// ==============================
// FUNCIÓN PRINCIPAL DEL BOT
// ==============================

async function iniciarBaileys() {
    console.log('\n🚀 Bot de Pie Consalud en MODO HUMANO...\n')

    try {
        // Crear carpeta auth si no existe
        if (!fs.existsSync('./auth_info')) {
            fs.mkdirSync('./auth_info', { recursive: true })
        }

        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Pie Consalud Bot', 'Chrome', '1.0'],
            printQRInTerminal: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: false,
            keepAliveIntervalMs: 25000,
            markOnlineOnConnect: false
        })
        
        sockInstance = sock

        // ==============================
        // EVENTO DE CONEXIÓN
        // ==============================

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                ultimoQR = qr
                botConectado = false
                const link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
                console.log('\n' + '='.repeat(50))
                console.log('📲 NUEVO QR GENERADO')
                console.log('='.repeat(50))
                console.log('Link:', link)
                console.log('📱 O visita /qr en tu dominio\n')
            }

            if (connection === 'open') {
                console.log('\n✅ WHATSAPP CONECTADO - MODO HUMANO ACTIVADO')
                console.log('👤 Usuario:', sock.user?.id)
                console.log('📊 Sesiones activas:', Object.keys(sesiones).length)
                console.log('💬 Listo para responder mensajes\n')
                botConectado = true
                ultimoQR = null
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                console.log('\n❌ Conexión cerrada, código:', statusCode)
                botConectado = false
                
                // Manejar diferentes códigos de error
                if (statusCode === 401) {
                    console.log('⚠️ Sesión expirada. Generando nuevo QR en 5 segundos...')
                    setTimeout(iniciarBaileys, 5000)
                } else if (statusCode === 403) {
                    console.log('⚠️ Número baneado. Esperando 1 hora...')
                    setTimeout(iniciarBaileys, 3600000)
                } else if (statusCode === 405) {
                    console.log('⚠️ Error de autenticación. Limpiando sesión...')
                    limpiezaProfunda()
                    setTimeout(iniciarBaileys, 5000)
                } else if (statusCode === 429) {
                    console.log('⚠️ Demasiadas solicitudes. Esperando 30 minutos...')
                    setTimeout(iniciarBaileys, 1800000)
                } else if (statusCode === 515) {
                    console.log('⚠️ WhatsApp pide descanso. Esperando 1 hora...')
                    setTimeout(iniciarBaileys, 3600000)
                } else if (statusCode !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reintentando en 30 segundos...')
                    setTimeout(iniciarBaileys, 30000)
                } else {
                    console.log('⚠️ Sesión cerrada manualmente. Nuevo QR en 5 segundos...')
                    ultimoQR = null
                    setTimeout(iniciarBaileys, 5000)
                }
            }
        })

        // ==============================
        // EVENTO DE MENSAJES
        // ==============================

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                // Solo mensajes nuevos
                if (type !== 'notify') return

                const msg = messages[0]
                
                // Ignorar mensajes propios
                if (!msg.message || msg.key.fromMe) return

                const from = msg.key.remoteJid
                
                // Solo chats privados
                if (from.includes('@g.us')) return

                // Extraer texto de TODOS los formatos posibles
                const text = 
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    ''

                if (!text) return

                console.log('\n📨 Mensaje de:', from)
                console.log('📨 Contenido:', text)

                const mensaje = text.toLowerCase().trim()
                let respuesta = ''

                // ===== LÓGICA DE RESPUESTAS =====
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
                else if (mensaje === '2' || mensaje.includes('precio')) {
                    respuesta = `🏷️ *Valores de Atención – Pie Consalud*\n\nAtención Podológica: *$20.000*\n\nTratamientos como:\n• Uña encarnada\n• Onicomicosis\n• Pie diabético\n\nEl valor puede variar según evaluación profesional.`
                }
                else if (mensaje === '3' || mensaje.includes('direccion') || mensaje.includes('ubicacion')) {
                    respuesta = `📍 *Nuestras Sucursales*\n\n🏙️ Ahumada  \nCerca de Metro U. de Chile / Plaza de Armas\n\n🏙️ Providencia  \nCerca de Metro Tobalaba\n\nEscribe el nombre de la sucursal para continuar.`
                }
                else if (mensaje === '4' || mensaje.includes('abono')) {
                    if (!sesiones[from]?.sucursal) {
                        respuesta = `Para enviarte los datos de abono, primero indícanos la sucursal:\n\n• Ahumada\n• Providencia`
                    }
                    else if (sesiones[from].sucursal === 'ahumada') {
                        respuesta = `💳 *Datos de Abono – Sucursal Ahumada*\n\nBanco Estado\nCuenta Corriente\nN° 29100119011\nRut: 77.478.206-0\nCorreo: Piesalud.21@gmail.com\n\nAbono: *$10.000*\nSe descuenta del total de la atención.`
                    }
                    else {
                        respuesta = `💳 *Datos de Abono – Sucursal Providencia*\n\nBanco Chile\nCuenta Vista\nN° 000083725182\nRut: 77.478.206-0\nCorreo: Pieconsalud@gmail.com\n\nAbono: *$10.000*\nSe descuenta del total de la atención.`
                    }
                }
                else if (mensaje === '5' || mensaje.includes('horario')) {
                    respuesta = `🕒 *Horario de Atención*\n\nLunes a viernes\n10:00 a 17:00 hrs\n\nSábados\n10:00 a 12:00 hrs`
                }
                else if (mensaje === '6' || mensaje.includes('pago')) {
                    respuesta = `💰 *Medios de Pago*\n\n✔️ Transferencia electrónica\n✔️ Efectivo\n\nEl abono de $10.000 se realiza vía transferencia al momento de agendar.`
                }
                else {
                    respuesta = `👣 *¡Hola! Bienvenido/a a Pie Consalud* 👣\n\nPor favor selecciona una opción:\n\n1️⃣ Reservar una hora\n2️⃣ Ver precios\n3️⃣ Ubicación\n4️⃣ Datos para abono\n5️⃣ Horarios\n6️⃣ Medios de pago`
                }

                // ===== MODO HUMANO: Envío con delays =====
                if (respuesta) {
                    
                    if (!SEGURIDAD.puedeEnviar(from)) {
                        console.log('⚠️ Límites de seguridad activados\n')
                        return
                    }
                    
                    // Indicar que está escribiendo
                    await sock.sendPresenceUpdate('composing', from)
                    
                    // Delay aleatorio (2-5 segundos)
                    const delayHumano = Math.floor(Math.random() * 3000) + 2000
                    console.log(`⏳ Esperando ${delayHumano}ms para parecer humano...`)
                    await new Promise(resolve => setTimeout(resolve, delayHumano))
                    
                    // Dejar de escribir
                    await sock.sendPresenceUpdate('paused', from)
                    
                    // Pequeña pausa
                    await new Promise(resolve => setTimeout(resolve, 500))
                    
                    // Enviar mensaje
                    console.log('📤 Enviando respuesta...')
                    await sock.sendMessage(from, { text: respuesta })
                    
                    // Registrar envío
                    SEGURIDAD.registrarEnvio(from)
                    
                    console.log('✅ Respuesta enviada\n')
                }

            } catch (error) {
                console.error('❌ Error procesando mensaje:', error)
            }
        })

        // Guardar credenciales
        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot escuchando mensajes...\n')

    } catch (error) {
        console.error('💥 Error iniciando bot:', error)
        setTimeout(iniciarBaileys, 30000)
    }
}

// ==============================
// INICIAR EL BOT
// ==============================

// DESCOMENTAR SOLO SI HAY PROBLEMAS GRAVES:
// limpiezaProfunda()

iniciarBaileys()