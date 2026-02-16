const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function assertAdmin(context) {
  if (!context.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const uid = context.auth.uid;
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) throw new HttpsError('permission-denied', 'Perfil no encontrado.');

  const u = userSnap.data() || {};
  const rol = u.rol || u.role || u.tipoUsuario || u.perfil;

  if (rol !== 'admin') throw new HttpsError('permission-denied', 'No autorizado.');
  return { uid, user: u };
}

exports.adminReopenCita = onCall(async (req) => {
  await assertAdmin(req);

  const citaId = req.data?.citaId;
  if (!citaId) throw new HttpsError('invalid-argument', 'citaId requerido.');

  const ref = db.doc(`citas/${citaId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Cita no encontrada.');

  const data = snap.data() || {};

  // Reabrir: vuelve a activa y limpia campos de cierre/atención si existen
  await ref.update({
    estado: 'activa',
    fechaHoraAtencionFin: admin.firestore.FieldValue.delete(),
    motivoCierre: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reopenedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true, fromEstado: data.estado || null };
});

exports.adminUpdateClosedCita = onCall(async (req) => {
  await assertAdmin(req);

  const citaId = req.data?.citaId;
  const estado = req.data?.estado;
  const observacion = req.data?.observacion;

  if (!citaId) throw new HttpsError('invalid-argument', 'citaId requerido.');

  const ref = db.doc(`citas/${citaId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Cita no encontrada.');

  // No permitir cambiar campos críticos desde acá
  const patch = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (typeof estado === 'string') patch.estado = estado;
  if (typeof observacion === 'string') patch.observacion = observacion;

  await ref.update(patch);
  return { ok: true };
});
