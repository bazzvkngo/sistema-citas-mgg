// src/components/admin/AdminHolidays.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

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
  formRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px",
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
};

export default function AdminHolidays() {
  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    fechaISO: "",
    descripcion: "",
    pais: "AMBOS",
  });

  // Escuchar cambios en la colección "feriados"
  useEffect(() => {
    const q = query(
      collection(db, "feriados"),
      orderBy("fechaISO", "asc")
    );

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();

    if (!form.fechaISO) {
      alert("Seleccione una fecha para el feriado.");
      return;
    }

    try {
      await addDoc(collection(db, "feriados"), {
        fechaISO: form.fechaISO, // input type="date" ya viene en formato YYYY-MM-DD
        descripcion: form.descripcion || "Feriado",
        pais: form.pais || "AMBOS",
        activo: true,
      });

      setForm({
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

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Gestión de Feriados / Días Bloqueados</h3>

      {/* Formulario para crear feriado */}
      <form onSubmit={handleAddHoliday} style={styles.formRow}>
        <input
          type="date"
          name="fechaISO"
          value={form.fechaISO}
          onChange={handleChange}
          style={styles.inputDate}
        />

        <input
          type="text"
          name="descripcion"
          placeholder="Descripción (opcional)"
          value={form.descripcion}
          onChange={handleChange}
          style={styles.inputText}
        />

        <select
          name="pais"
          value={form.pais}
          onChange={handleChange}
          style={styles.select}
        >
          <option value="AMBOS">Ambos</option>
          <option value="CL">Chile</option>
          <option value="PE">Perú</option>
        </select>

        <button type="submit" style={styles.buttonAdd}>
          Agregar feriado
        </button>
      </form>

      {/* Tabla de feriados existentes */}
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
                    style={{
                      ...styles.buttonSmall,
                      ...styles.buttonToggle,
                    }}
                    onClick={() => handleToggleActivo(f)}
                  >
                    {f.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.buttonSmall,
                      ...styles.buttonDelete,
                    }}
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
