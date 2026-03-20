export default function resolveUserRole(user) {
  if (!user) return '';

  const rawRole = user.rol ?? user.role ?? user.tipoUsuario ?? user.perfil ?? '';
  const role = String(rawRole).toLowerCase().trim();

  if (role === 'superadmin') return 'superadmin';
  if (user.isAdmin === true) return 'admin';
  if (role === 'agent') return 'agente';

  return role;
}
