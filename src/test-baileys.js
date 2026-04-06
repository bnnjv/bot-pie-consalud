// IMPORTACIÓN CORRECTA
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

// ==============================
// MEMORIA DE CLIENTES
// ==============================
const clientesDB = new Map()
try {
    if (fs.existsSync('./clientes.json')) {
        const data = fs.readFileSync('./clientes.json', 'utf8')
        const clientes = JSON.parse(data)
        Object.keys(clientes).forEach(key => clientesDB.set(key, clientes[key]))
        console.log('📚 Clientes cargados:', clientesDB.size)
    }
} catch (e) {
    console.log('No hay clientes previos')
}

// Guardar clientes cada 5 minutos
setInterval(() => {
    try {
        const clientesObj = Object.fromEntries(clientesDB)
        fs.writeFileSync('./clientes.json', JSON.stringify(clientesObj, null, 2))
        console.log('💾 Clientes guardados:', clientesDB.size)
    } catch (e) {
        console.error('Error guardando clientes:', e)
    }
}, 300000)

// Estado del bot
let botConectado = false
let sockInstance = null
let ultimoQR = null

// ==============================
// COLA DE MENSAJES
// ==============================
const colaMensajes = []
let procesandoCola = false

async function procesarCola() {
    if (procesandoCola || colaMensajes.length === 0) return
    
    procesandoCola = true
    
    while (colaMensajes.length > 0) {
        const { from, respuesta, sock, intentos = 0 } = colaMensajes.shift()
        
        try {
            if (!sock || !sock.user) {
                console.log('⚠️ Socket no disponible, reintentando después...')
                colaMensajes.unshift({ from, respuesta, sock, intentos })
                await new Promise(resolve => setTimeout(resolve, 5000))
                continue
            }
            
            await sock.sendPresenceUpdate('composing', from)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
            await sock.sendPresenceUpdate('paused', from)
            await new Promise(resolve => setTimeout(resolve, 500))
            
            await sock.sendMessage(from, { text: respuesta })
            console.log('✅ Mensaje enviado desde cola a:', from)
            
            await new Promise(resolve => setTimeout(resolve, 3000))
            
        } catch (error) {
            console.error('❌ Error en cola para', from, ':', error.message)
            if (intentos < 3) {
                console.log(`🔄 Reintentando (${intentos + 1}/3) para:`, from)
                colaMensajes.push({ from, respuesta, sock, intentos: intentos + 1 })
            } else {
                console.log('❌ Mensaje descartado después de 3 intentos:', from)
            }
        }
    }
    
    procesandoCola = false
}

// ==============================
// CONFIGURACIÓN DE SEGURIDAD
// ==============================

const SEGURIDAD = {
    mensajesPorMinuto: 0,
    ultimoReset: Date.now(),
    maxPorMinuto: 6,
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
        if (Date.now() - ultimoMensaje < 15000) {
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
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="card">
                        <h1>🤖 Bot Pie Consalud - VERSIÓN PRO</h1>
                        <p>Estado: <span class="${botConectado ? 'online' : 'offline'}">${botConectado ? '✅ CONECTADO' : '❌ DESCONECTADO'}</span></p>
                        <p>📊 Sesiones activas: ${Object.keys(sesiones).length}</p>
                        <p>👥 Clientes únicos: ${clientesDB.size}</p>
                        <p>⏱️ Mensajes/minuto: ${SEGURIDAD.mensajesPorMinuto}/${SEGURIDAD.maxPorMinuto}</p>
                        <p>📨 Cola mensajes: ${colaMensajes.length}</p>
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
                        <button onclick="location.href='/limpiar'">🧹 Limpiar Sesión</button>
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
        clientes_unicos: clientesDB.size,
        sock_exists: !!sockInstance,
        user: sockInstance?.user || null,
        cola_mensajes: colaMensajes.length,
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
        res.send('🧹 Sesión limpiada. Reinicia el bot.')
    } catch (error) {
        res.send('❌ Error al limpiar: ' + error.message)
    }
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
    console.log('🤖 VERSIÓN PRO - Sin versión forzada + Filtro de IDs')
    iniciarBaileys()
})

// ==============================
// FUNCIÓN PRINCIPAL
// ==============================

async function iniciarBaileys() {
    console.log('🚀 Bot Versión Pro...\n')

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

        // 🔥 VERSIÓN CORRECTA - SIN forzar version incorrecta
        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Pie Consalud Bot', 'Chrome', '1.0'],
            printQRInTerminal: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: false,
            keepAliveIntervalMs: 25000,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 5000,
            maxRetries: 5
            // ❌ ELIMINADO: version: [2, 2413, 1]
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
                console.log('\n📲 ESCANEA ESTE QR:')
                console.log(link + '\n')
            }

            if (connection === 'open') {
                console.log('✅ WhatsApp conectado - VERSIÓN PRO')
                console.log('👤 Usuario:', sock.user?.id)
                botConectado = true
                ultimoQR = null
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const errorMsg = lastDisconnect?.error?.message || ''
                console.log('❌ Conexión cerrada, código:', statusCode, 'Error:', errorMsg)
                botConectado = false
                
                if (statusCode !== DisconnectReason.loggedOut) {
                    const tiempoEspera = errorMsg.includes('rate') ? 60000 : 10000
                    console.log(`🔄 Reconectando en ${tiempoEspera/1000} segundos...`)
                    setTimeout(iniciarBaileys, tiempoEspera)
                } else {
                    console.log('⚠️ Sesión cerrada. Se generará nuevo QR...')
                    ultimoQR = null
                    setTimeout(iniciarBaileys, 5000)
                }
            }
        })

        // ==============================
        // MENSAJES - CON FILTRO DE IDS
        // ==============================

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (!sock || !sock.user) return
                if (type !== 'notify') return

                const msg = messages[0]
                
                if (!msg.message || msg.key.fromMe) return
                if (msg.key.remoteJid === 'status@broadcast') return

                let from = msg.key.remoteJid
                
                console.log('\n📨 Mensaje recibido:')
                console.log('   remoteJid:', msg.key.remoteJid)
                console.log('   participant:', msg.key.participant)
                
                if (from.includes('@g.us')) {
                    console.log('   ⏭️ Ignorando grupo')
                    return
                }
                
                if (!from.endsWith('@s.whatsapp.net')) {
                    console.log('   ⏭️ Ignorando ID no estándar:', from)
                    return
                }
                
                // 🔥 FILTRO DE ID VÁLIDO
                const numero = from.split('@')[0]
                
                // Los IDs válidos tienen entre 11 y 15 dígitos
                if (numero.length < 11 || numero.length > 15) {
                    console.log(`   ⏭️ ID inválido (${numero.length} dígitos):`, from)
                    return
                }
                
                console.log('   ✅ ID válido (longitud:', numero.length, ')')

                const text =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.ephemeralMessage?.message?.conversation ||
                    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption ||
                    ''

                if (!text) {
                    console.log('   ⏭️ Mensaje sin texto')
                    return
                }

                console.log('   📝 Texto:', text)

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

                if (respuesta) {
                    console.log('   📤 Respondiendo a:', from)
                    
                    if (!clientesDB.has(from)) {
                        clientesDB.set(from, {
                            primerContacto: Date.now(),
                            ultimoContacto: Date.now(),
                            totalMensajes: 1,
                            numero: numero
                        })
                    } else {
                        const c = clientesDB.get(from)
                        c.ultimoContacto = Date.now()
                        c.totalMensajes++
                    }
                    
                    colaMensajes.push({ from, respuesta, sock })
                    procesarCola()
                    
                    console.log('   ✅ Mensaje encolado para:', from)
                    console.log('')
                }

            } catch (error) {
                console.error('❌ Error:', error)
            }
        })

        sock.ev.on('creds.update', saveCreds)
        
        console.log('🎧 Bot listo - Con filtro de IDs válidos')

    } catch (error) {
        console.error('💥 Error:', error)
        setTimeout(iniciarBaileys, 10000)
    }
}