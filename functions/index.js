// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { format, setHours, setMinutes } = require("date-fns");

// Regiones
const SANTIAGO_REGION = "southamerica-west1";
const CRON_JOB_REGION = "us-central1";

initializeApp();
const db = getFirestore();

// =========================================
// Helper zona horaria Chile para métricas
// =========================================
const TZ_OFFSET = "-03:00"; // Chile continental en diciembre (UTC-3)

/**
 * Construye el rango de fechas en horario local Chile:
 *  - startDateISO → 00:00:00 del día inicial
 *  - endDateISO   → 23:59:59.999 del día final
 * y devuelve Timestamps listos para Firestore.
 */
function buildLocalRange(startDateISO, endDateISO) {
  const startDate = new Date(`${startDateISO}T00:00:00.000${TZ_OFFSET}`);
  const endDate = new Date(`${endDateISO}T23:59:59.999${TZ_OFFSET}`);

  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

/**
 * @name checkDniExists
 */
exports.checkDniExists = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const dni = request.data.dni;
  if (!dni || dni.length < 7) {
    throw new HttpsError("invalid-argument", "El DNI proporcionado no es válido.");
  }
  try {
    const q = db.collection("usuarios")
      .where("dni", "==", dni)
      .limit(1);

    const querySnapshot = await q.get();
    return { exists: !querySnapshot.empty };

  } catch (error) {
    console.error("Error al verificar DNI:", error);
    throw new HttpsError("internal", "Ocurrió un error interno al verificar el DNI.");
  }
});


/**
 * @name marcarCitasAusentes
 */
exports.marcarCitasAusentes = onSchedule({
  region: CRON_JOB_REGION,
  schedule: "every 5 minutes",
  timeZone: "America/Santiago",
}, async () => {

  const MARGEN_TOLERANCIA_MIN = 15;

  const now = Timestamp.now();
  const cutoffMillis = now.toMillis() - (MARGEN_TOLERANCIA_MIN * 60 * 1000);
  const cutoffTime = Timestamp.fromMillis(cutoffMillis);

  const q = db.collection("citas")
    .where("estado", "==", "activa")
    .where("fechaHora", "<", cutoffTime);

  try {
    const snapshot = await q.get();
    if (snapshot.empty) return null;

    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        estado: "completado",
        clasificacion: "NO_SE_PRESENTO",
        comentariosAgente: `Sistema automático: Cita expiró tras ${MARGEN_TOLERANCIA_MIN} min.`,
        fechaHoraAtencionFin: now,
      });
    });

    await batch.commit();
    return null;

  } catch (error) {
    console.error("Error en 'marcarCitasAusentes':", error);
    throw new HttpsError("internal", "Error al procesar citas ausentes.");
  }
});


/**
 * @name getAvailableSlots
 * Horarios disponibles para un trámite en una fecha.
 * - Bloquea fines de semana
 * - Bloquea feriados cargados en la colección "feriados"
 */
exports.getAvailableSlots = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { tramiteId, fechaISO } = request.data;

  if (!tramiteId || !fechaISO) {
    throw new HttpsError("invalid-argument", "tramiteId y fechaISO son requeridos.");
  }

  try {
    const selectedDate = new Date(fechaISO);
    const dayOfWeek = selectedDate.getDay();

    // Bloquear fines de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { slots: [] };
    }

    // Bloquear feriados configurados por el admin en Firestore
    // Colección: "feriados" con campos: fechaISO (YYYY-MM-DD), activo (bool)
    const dateKey = selectedDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const feriadosSnap = await db
      .collection("feriados")
      .where("fechaISO", "==", dateKey)
      .where("activo", "==", true)
      .get();

    if (!feriadosSnap.empty) {
      // Es feriado → no se ofrecen horarios
      return { slots: [], motivo: "feriado" };
    }

    // El trámite existe
    const tramiteDoc = await db.collection("tramites").doc(tramiteId).get();
    if (!tramiteDoc.exists) {
      throw new HttpsError("not-found", "El trámite no existe.");
    }

    const tramiteData = tramiteDoc.data();
    const duracion = tramiteData.duracionMin || 15;

    // Rango de jornada (ejemplo 09:00 a 12:30)
    const startTime = setHours(setMinutes(selectedDate, 0), 9);
    const endTime = setHours(setMinutes(selectedDate, 30), 12);

    const firestoreInicioDelDia = Timestamp.fromDate(
      setHours(selectedDate, 0, 0, 0)
    );
    const firestoreFinDelDia = Timestamp.fromDate(
      setHours(selectedDate, 23, 59, 59)
    );

    // Citas ya reservadas para ese trámite en ese día
    const q = db.collection("citas")
      .where("tramiteID", "==", tramiteId)
      .orderBy("fechaHora")
      .startAt(firestoreInicioDelDia)
      .endAt(firestoreFinDelDia);

    const citasSnapshot = await q.get();

    const bookedSlots = new Set(
      citasSnapshot.docs.map(doc =>
        format(doc.data().fechaHora.toDate(), "HH:mm")
      )
    );

    // Generar todos los posibles slots
    const allSlots = [];
    let currentTime = startTime;

    while (currentTime < endTime) {
      allSlots.push(new Date(currentTime));
      currentTime.setMinutes(currentTime.getMinutes() + duracion);
    }

    // Filtrar los que ya están tomados
    const available = allSlots
      .map(slot => format(slot, "HH:mm"))
      .filter(slotString => !bookedSlots.has(slotString));

    return { slots: available };

  } catch (error) {
    console.error("Error en getAvailableSlots:", error);
    throw new HttpsError("internal", "Error al buscar horarios.");
  }
});


/**
 * @name generarTurnoKiosko
 */
exports.generarTurnoKiosko = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { dniLimpio, tramiteId } = request.data;

  if (!dniLimpio || !tramiteId) {
    throw new HttpsError("invalid-argument", "dniLimpio y tramiteId son requeridos.");
  }

  try {
    const qCitas = db.collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa");

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene una CITA activa para este trámite.");
    }

    const qTurnos = db.collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera");

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene un TURNO en espera para este trámite.");
    }

    const tramiteDoc = await db.collection("tramites").doc(tramiteId).get();
    if (!tramiteDoc.exists) throw new HttpsError("not-found", "El trámite no existe.");

    const tramiteData = tramiteDoc.data();
    const tramiteNombre = tramiteData.nombre;
    const prefijo = tramiteData.prefijo;

    if (!prefijo) {
      throw new HttpsError("failed-precondition", `El trámite '${tramiteNombre}' no tiene un prefijo configurado.`);
    }

    const contadorRef = db.collection("contadores").doc(tramiteId);
    const turnoRef = db.collection("turnos").doc();

    // Transacción correcta
    const nuevoCodigo = await db.runTransaction(async (transaction) => {

      const contadorDoc = await transaction.get(contadorRef);

      let nuevoValor = 1;
      if (contadorDoc.exists) {
        nuevoValor = (contadorDoc.data().valor || 0) + 1;
      }

      const codigoGenerado =
        `${prefijo}-${String(nuevoValor).padStart(3, "0")}`;

      transaction.set(contadorRef, { valor: nuevoValor }, { merge: true });

      transaction.set(turnoRef, {
        dni: dniLimpio,
        tramiteID: tramiteId,
        codigo: codigoGenerado,
        fechaHoraGenerado: Timestamp.now(),
        estado: "en-espera",
      });

      return codigoGenerado;
    });

    return {
      id: turnoRef.id,
      codigo: nuevoCodigo,
      nombre: tramiteNombre,
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;

    console.error("Error al generar turno Kiosko:", error);
    throw new HttpsError("internal", "Error al generar su turno. Intente de nuevo.");
  }
});


/**
 * @name checkDuplicados
 */
exports.checkDuplicados = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { dniLimpio, tramiteId } = request.data;

  if (!dniLimpio || !tramiteId) {
    throw new HttpsError("invalid-argument", "dniLimpio y tramiteId son requeridos.");
  }

  try {
    const qCitas = db.collection("citas")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "activa");

    const citasSnap = await qCitas.get();
    if (!citasSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene una CITA activa.");
    }

    const qTurnos = db.collection("turnos")
      .where("dni", "==", dniLimpio)
      .where("tramiteID", "==", tramiteId)
      .where("estado", "==", "en-espera");

    const turnosSnap = await qTurnos.get();
    if (!turnosSnap.empty) {
      throw new HttpsError("already-exists", "Error: Usted ya tiene un TURNO en espera.");
    }

    return { exists: false };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error en checkDuplicados:", error);
    throw new HttpsError("internal", "Error al verificar duplicados.");
  }
});


/**
 * @name resetContadoresDiarios
 */
exports.resetContadoresDiarios = onSchedule({
  region: CRON_JOB_REGION,
  schedule: "0 0 * * *",
  timeZone: "America/Santiago",
}, async () => {

  try {
    const contadoresSnapshot = await db.collection("contadores").get();
    if (contadoresSnapshot.empty) return null;

    const batch = db.batch();
    contadoresSnapshot.forEach(doc =>
      batch.update(doc.ref, { valor: 0 })
    );

    await batch.commit();
    return null;

  } catch (error) {
    console.error("Error en 'resetContadoresDiarios':", error);
    throw new HttpsError("internal", "Error al resetear los contadores.");
  }
});


/**
 * @name getMetricsData
 * Lógica de clasificación + detalle para Excel
 */
exports.getMetricsData = onCall({ region: SANTIAGO_REGION }, async (request) => {
  const { startDateISO, endDateISO } = request.data || {};

  if (!startDateISO || !endDateISO) {
    throw new HttpsError("invalid-argument", "Fechas son requeridas.");
  }

  try {
    // Rango en horario Chile (UTC-3), día completo
    const { start, end } = buildLocalRange(startDateISO, endDateISO);

    // Stats separados por origen
    const stats = {
      citas: {
        atendido_total: 0,
        fallo_accion: 0,
        no_presento: 0,
      },
      turnos: {
        atendido_total: 0,
        fallo_accion: 0,
        no_presento: 0,
      },
      detalleCitas: [],
      detalleTurnos: [],
    };

    const acumularDocumento = (coleccion, docId, data) => {
      const targetStats = coleccion === "citas" ? stats.citas : stats.turnos;
      const detalleArr = coleccion === "citas" ? stats.detalleCitas : stats.detalleTurnos;

      const clasificacion = data.clasificacion || "SIN_CLASIFICAR";

      // Clasificación en buckets
      switch (clasificacion) {
        // ATENDIDAS
        case "ATENDIDO_OK":
        case "ATENDIDO":
        case "TRAMITE_OK":
        case "CONSULTA_RESUELTA":
        case "ENTREGA_OK":
        case "OTRO":
          targetStats.atendido_total++;
          break;

        // FALLIDAS / DERIVADAS / INCOMPLETAS
        case "FALLO_ACCION":
        case "RECHAZADO":
        case "FALTAN_DOCUMENTOS":
        case "DERIVADO_INTERNO":
          targetStats.fallo_accion++;
          break;

        // NO SE PRESENTÓ
        case "NO_SE_PRESENTO":
          targetStats.no_presento++;
          break;

        default:
          // SIN_CLASIFICAR: solo va al detalle
          break;
      }

      let fechaAtencion = null;
      if (data.fechaHoraAtencionFin && typeof data.fechaHoraAtencionFin.toDate === "function") {
        fechaAtencion = data.fechaHoraAtencionFin.toDate().toISOString();
      }

      // Registro de detalle para Excel
      detalleArr.push({
        id: docId,
        codigo: data.codigo || "",
        dni: data.dni || "",
        tramiteID: data.tramiteID || "",
        clasificacion,
        comentario: data.comentariosAgente || "",
        modulo: data.modulo || data.moduloAsignado || "",
        fechaHoraAtencionFin: fechaAtencion,
      });
    };

    const colecciones = ["citas", "turnos"];

    for (const collectionName of colecciones) {
      const q = db
        .collection(collectionName)
        .where("estado", "==", "completado")
        .where("fechaHoraAtencionFin", ">=", start)
        .where("fechaHoraAtencionFin", "<=", end);

      const snapshot = await q.get();

      snapshot.forEach((doc) => {
        acumularDocumento(collectionName, doc.id, doc.data());
      });
    }

    return stats;

  } catch (error) {
    console.error("Error en getMetricsData:", error);
    throw new HttpsError("internal", "Error al procesar métricas. Revisa los índices.");
  }
});


/**
 * @name resetPantallaTvDiaria
 * Limpia la llamada actual, el historial y el estado de cada trámite
 * en la Pantalla TV cada medianoche.
 */
exports.resetPantallaTvDiaria = onSchedule({
  region: CRON_JOB_REGION,
  schedule: "0 0 * * *", // todos los días a las 00:00
  timeZone: "America/Santiago",
}, async () => {
  try {
    const estadoColRef = db.collection("estadoSistema");

    const llamadaActualRef = estadoColRef.doc("llamadaActual");
    const historialRef = estadoColRef.doc("historialLlamadas");

    // Obtenemos TODOS los docs de estadoSistema para limpiar los tramite_*
    const estadoSnap = await estadoColRef.get();

    const batch = db.batch();

    // 1) Dejar llamadaActual en blanco (con el doc existente)
    batch.set(llamadaActualRef, {}, { merge: true });

    // 2) Vaciar el historial de llamados
    batch.set(
      historialRef,
      { ultimos: [] },
      { merge: true }
    );

    // 3) Resetear cada documento de estadoSistema que represente un trámite
    estadoSnap.forEach((docSnap) => {
      const docId = docSnap.id;

      // Solo los docs tipo "tramite_xxx"
      if (docId.startsWith("tramite_")) {
        batch.set(
          docSnap.ref,
          {
            codigoLlamado: null,
            modulo: null,
            timestamp: null,
          },
          { merge: true }
        );
      }
    });

    await batch.commit();

    console.log("resetPantallaTvDiaria: pantalla TV reseteada correctamente.");
    return null;
  } catch (error) {
    console.error("Error en 'resetPantallaTvDiaria':", error);
    throw new HttpsError("internal", "Error al resetear la Pantalla TV.");
  }
});
