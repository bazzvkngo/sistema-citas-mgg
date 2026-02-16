// src/components/admin/AdminHolidays.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

// --- Helpers rango ---
function parseISODateToUTCDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}
function toISODateUTC(date) {
  return date.toISOString().slice(0, 10);
}
function eachDayISOInclusive(startISO, endISO) {
  const start = parseISODateToUTCDate(startISO);
  const end = parseISODateToUTCDate(endISO);
  const out = [];
  let cur = new Date(start);
  while (cur <= end) {
    out.push(toISODateUTC(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
function buildFeriadoDocId(fechaISO, pais) {
  return `${fechaISO}__${pais || "AMBOS"}`;
}

// Estilos similares a los otros paneles de admin
const styles = {
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    padding: "25px",
    marginBottom: "30px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#555",
    marginTop: "18px",
    marginBottom: "10px",
  },
  formRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "12px",
    alignItems: "center",
  },
  inputDate: {
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "14px",
  },
  inputText: {
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "14px",
    minWidth: "200px",
  },
  select: {
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "14px",
  },
  buttonAdd: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#C8102E",
    color: "white",
  },
  buttonSecondary: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#fff",
    color: "#333",
  },
  buttonDanger: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#dc3545",
    color: "white",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#444",
    marginTop: "6px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
  th: {
    textAlign: "left",
    padding: "8px",
    fontSize: "13px",
    textTransform: "uppercase",
    borderBottom: "1px solid #e0e0e0",
    color: "#555",
  },
  td: {
    padding: "8px",
    fontSize: "14px",
    borderBottom: "1px solid #f0f0f0",
  },
  badgeActivo: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "bold",
    backgroundColor: "#d4edda",
    color: "#155724",
  },
  badgeInactivo: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "bold",
    backgroundColor: "#f8d7da",
    color: "#721c24",
  },
  buttonSmall: {
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    marginRight: "6px",
  },
  buttonToggle: {
    backgroundColor: "#007bff",
    color: "white",
  },
  buttonDelete: {
    backgroundColor: "#dc3545",
    color: "white",
  },
  hint: {
    fontSize: "12px",
    color: "#666",
    marginTop: "-4px",
    marginBottom: "8px",
  },
};

export default function AdminHolidays() {
  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formDia, setFormDia] = useState({
    fechaISO: "",
    descripcion: "",
    pais: "AMBOS",
  });

  const [formRango, setFormRango] = useState({
    startISO: "",
    endISO: "",
    descripcion: "Cierre temporal",
    pais: "AMBOS",
    desbloqueoModo: "desactivar", // "desactivar" | "eliminar"
  });

  const [busyRange, setBusyRange] = useState(false);

  // Escuchar cambios en la colección "feriados"
  useEffect(() => {
    const q = query(collection(db, "feriados"), orderBy("fechaISO", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setFeriados(items);
        setLoading(false);
      },
      (error) => {
        console.error("Error al escuchar feriados:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const feriadosByKey = useMemo(() => {
    const map = new Map();
    for (const f of feriados) {
      const key = buildFeriadoDocId(f.fechaISO, f.pais || "AMBOS");
      map.set(key, f);
    }
    return map;
  }, [feriados]);

  const handleChangeDia = (e) => {
    const { name, value } = e.target;
    setFormDia((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangeRango = (e) => {
    const { name, value } = e.target;
    setFormRango((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // --- Un día ---
  const handleAddHoliday = async (e) => {
    e.preventDefault();

    if (!formDia.fechaISO) {
      alert("Seleccione una fecha para el feriado.");
      return;
    }

    try {
      const id = buildFeriadoDocId(formDia.fechaISO, formDia.pais);
      await setDoc(
        doc(db, "feriados", id),
        {
          fechaISO: formDia.fechaISO,
          descripcion: formDia.descripcion || "Feriado",
          pais: formDia.pais || "AMBOS",
          activo: true,
          tipo: "bloqueo",
        },
        { merge: true }
      );

      setFormDia({
        fechaISO: "",
        descripcion: "",
        pais: "AMBOS",
      });
    } catch (error) {
      console.error("Error al agregar feriado:", error);
      alert("Ocurrió un error al agregar el feriado.");
    }
  };

  const handleToggleActivo = async (feriado) => {
    try {
      await updateDoc(doc(db, "feriados", feriado.id), {
        activo: !feriado.activo,
      });
    } catch (error) {
      console.error("Error al cambiar estado de feriado:", error);
      alert("No se pudo cambiar el estado del feriado.");
    }
  };

  const handleDelete = async (feriado) => {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar el feriado del ${feriado.fechaISO}?`
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "feriados", feriado.id));
    } catch (error) {
      console.error("Error al eliminar feriado:", error);
      alert("No se pudo eliminar el feriado.");
    }
  };

  // --- Bloquear rango: crea/actualiza docs por día ---
  const handleBlockRange = async () => {
    const { startISO, endISO, descripcion, pais } = formRango;

    if (!startISO || !endISO) {
      alert("Selecciona fecha inicio y fecha fin.");
      return;
    }
    if (startISO > endISO) {
      alert("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    const ok = window.confirm(
      `Esto bloqueará el agendamiento desde ${startISO} hasta ${endISO} (${pais}).\n¿Continuar?`
    );
    if (!ok) return;

    setBusyRange(true);
    try {
      const days = eachDayISOInclusive(startISO, endISO);

      const batch = writeBatch(db);
      for (const fechaISO of days) {
        const id = buildFeriadoDocId(fechaISO, pais);
        const ref = doc(db, "feriados", id);

        batch.set(
          ref,
          {
            fechaISO,
            descripcion: descripcion || "Cierre temporal",
            pais: pais || "AMBOS",
            activo: true,
            tipo: "bloqueo_rango",
            rango: { startISO, endISO },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
      await batch.commit();

      alert("Rango bloqueado correctamente.");
    } catch (err) {
      console.error("Error al bloquear rango:", err);
      alert("Error al bloquear rango.");
    } finally {
      setBusyRange(false);
    }
  };

  // --- Desbloquear rango: desactivar o eliminar docs existentes del rango ---
  const handleUnblockRange = async () => {
    const { startISO, endISO, pais, desbloqueoModo } = formRango;

    if (!startISO || !endISO) {
      alert("Selecciona fecha inicio y fecha fin.");
      return;
    }
    if (startISO > endISO) {
      alert("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    const ok = window.confirm(
      `Esto desbloqueará el agendamiento desde ${startISO} hasta ${endISO} (${pais}).\nModo: ${desbloqueoModo}.\n¿Continuar?`
    );
    if (!ok) return;

    setBusyRange(true);
    try {
      const days = eachDayISOInclusive(startISO, endISO);

      const batch = writeBatch(db);

      for (const fechaISO of days) {
        const key = buildFeriadoDocId(fechaISO, pais);
        const f = feriadosByKey.get(key);
        if (!f) continue;

        const ref = doc(db, "feriados", f.id);

        if (desbloqueoModo === "eliminar") {
          batch.delete(ref);
        } else {
          batch.update(ref, { activo: false });
        }
      }

      await batch.commit();
      alert("Rango desbloqueado correctamente.");
    } catch (err) {
      console.error("Error al desbloquear rango:", err);
      alert("Error al desbloquear rango.");
    } finally {
      setBusyRange(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Gestión de Feriados / Días Bloqueados</h3>

      <div style={styles.sectionTitle}>Bloquear un día</div>

      <form onSubmit={handleAddHoliday} style={styles.formRow}>
        <input
          type="date"
          name="fechaISO"
          value={formDia.fechaISO}
          onChange={handleChangeDia}
          style={styles.inputDate}
        />

        <input
          type="text"
          name="descripcion"
          placeholder="Descripción (opcional)"
          value={formDia.descripcion}
          onChange={handleChangeDia}
          style={styles.inputText}
        />

        <select
          name="pais"
          value={formDia.pais}
          onChange={handleChangeDia}
          style={styles.select}
        >
          <option value="AMBOS">Ambos</option>
          <option value="CL">Chile</option>
          <option value="PE">Perú</option>
        </select>

        <button type="submit" style={styles.buttonAdd}>
          Agregar día bloqueado
        </button>
      </form>

      <div style={styles.sectionTitle}>Bloquear / Desbloquear rango</div>
      <div style={styles.hint}>
        Esto bloquea el agendamiento (porque tu Cloud Function revisa la colección{" "}
        <b>feriados</b> por <b>fechaISO</b> y <b>activo</b>).
      </div>

      <div style={styles.formRow}>
        <input
          type="date"
          name="startISO"
          value={formRango.startISO}
          onChange={handleChangeRango}
          style={styles.inputDate}
        />
        <input
          type="date"
          name="endISO"
          value={formRango.endISO}
          onChange={handleChangeRango}
          style={styles.inputDate}
        />

        <select
          name="pais"
          value={formRango.pais}
          onChange={handleChangeRango}
          style={styles.select}
        >
          <option value="AMBOS">Ambos</option>
          <option value="CL">Chile</option>
          <option value="PE">Perú</option>
        </select>

        <input
          type="text"
          name="descripcion"
          placeholder="Motivo (ej: Cierre temporal)"
          value={formRango.descripcion}
          onChange={handleChangeRango}
          style={styles.inputText}
        />
      </div>

      <div style={styles.formRow}>
        <button
          type="button"
          style={styles.buttonAdd}
          disabled={busyRange}
          onClick={handleBlockRange}
        >
          {busyRange ? "Procesando..." : "Bloquear rango"}
        </button>

        <select
          name="desbloqueoModo"
          value={formRango.desbloqueoModo}
          onChange={handleChangeRango}
          style={styles.select}
          disabled={busyRange}
          title="Desactivar = deja registro en BD pero inactivo. Eliminar = borra docs."
        >
          <option value="desactivar">Desbloquear (desactivar)</option>
          <option value="eliminar">Desbloquear (eliminar)</option>
        </select>

        <button
          type="button"
          style={styles.buttonSecondary}
          disabled={busyRange}
          onClick={handleUnblockRange}
        >
          {busyRange ? "Procesando..." : "Aplicar desbloqueo"}
        </button>
      </div>

      {loading ? (
        <p>Cargando feriados...</p>
      ) : feriados.length === 0 ? (
        <p>No hay feriados configurados.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Descripción</th>
              <th style={styles.th}>País</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {feriados.map((f) => (
              <tr key={f.id}>
                <td style={styles.td}>{f.fechaISO}</td>
                <td style={styles.td}>{f.descripcion}</td>
                <td style={styles.td}>{f.pais || "AMBOS"}</td>
                <td style={styles.td}>
                  {f.activo ? (
                    <span style={styles.badgeActivo}>Activo</span>
                  ) : (
                    <span style={styles.badgeInactivo}>Inactivo</span>
                  )}
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    style={{ ...styles.buttonSmall, ...styles.buttonToggle }}
                    onClick={() => handleToggleActivo(f)}
                  >
                    {f.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.buttonSmall, ...styles.buttonDelete }}
                    onClick={() => handleDelete(f)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
