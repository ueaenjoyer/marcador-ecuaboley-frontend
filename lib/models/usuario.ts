// Modelo Usuario — 1 de 2 entidades exigidas por el Prototipo 13.
// Todos los opcionales son anulables. Sin secretos ni hashes en el cliente.

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  role: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const usuarioFromJson = (json: unknown): Usuario => {
  if (!isRecord(json)) throw new Error('Usuario inválido: no es objeto.');
  const { id, email, nombre, role } = json;
  if (typeof id !== 'string' || !id) throw new Error('Usuario inválido: id.');
  if (typeof email !== 'string' || !email) throw new Error('Usuario inválido: email.');
  if (typeof nombre !== 'string') throw new Error('Usuario inválido: nombre.');
  if (typeof role !== 'string') throw new Error('Usuario inválido: role.');
  return { id, email, nombre, role };
};

export const usuarioToJson = (u: Usuario): Record<string, unknown> => ({
  id: u.id,
  email: u.email,
  nombre: u.nombre,
  role: u.role,
});
