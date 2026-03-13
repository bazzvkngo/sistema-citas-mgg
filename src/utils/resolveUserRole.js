export default function resolveUserRole(user) {
  if (!user) return '';
  if (user.isAdmin === true) return 'admin';

  const rawRole = user.rol ?? user.role ?? user.tipoUsuario ?? user.perfil ?? '';
  const role = String(rawRole).toLowerCase().trim();

  if (role === 'agent') return 'agente';

  return role;
}
