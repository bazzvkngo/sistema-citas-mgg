import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 40px', color: '#10233d' }}>
      <div
        style={{
          borderRadius: '24px',
          padding: '24px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,249,252,0.98) 100%)',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 18px 38px rgba(15, 23, 42, 0.08)'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8102e' }}>
          Privacidad
        </div>
        <h1 style={{ margin: '8px 0 10px', fontSize: '32px', lineHeight: 1.05 }}>
          Politica de privacidad
        </h1>
        <p style={{ margin: '0 0 18px', color: '#41536b', lineHeight: 1.6 }}>
          Este aviso resume el uso basico de datos personales dentro del sistema de citas.
        </p>

        <section style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Datos tratados</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            Para registrar y administrar su cita se pueden tratar datos de identificacion y contacto,
            como documento, nombre y correo electronico, junto con la informacion operativa necesaria
            del tramite solicitado.
          </p>
        </section>

        <section style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Finalidad</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            Los datos se usan para reservar la cita, enviar la confirmacion, gestionar la atencion y
            permitir el seguimiento del turno mediante mecanismos publicos saneados sin exponer datos
            personales.
          </p>
        </section>

        <section style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Conservacion y acceso</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            El acceso a la informacion se limita a los flujos internos necesarios para operar el
            sistema. Las vistas publicas de seguimiento muestran solo datos minimos del turno.
          </p>
        </section>

        <section>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Consentimiento</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            Al confirmar una cita, usted acepta este aviso de privacidad para el tratamiento de los
            datos necesarios en la gestion de su solicitud.
          </p>
        </section>

        <section style={{ marginTop: '16px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Derechos ARCO</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            Si necesitas ejercer tus derechos de acceso, rectificacion, cancelacion u oposicion,
            puedes ingresar una solicitud desde{' '}
            <a href="/derechos-arco" style={{ color: '#c8102e', fontWeight: 800 }}>
              este canal ARCO
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
