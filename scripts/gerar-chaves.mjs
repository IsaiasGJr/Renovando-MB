// Gera as chaves de criptografia de dados pessoais (CPF e WhatsApp).
// Copie as DUAS linhas para o .env da API (api/.env) E do admin (admin/servidor/.env): precisam ser iguais.
// Guarde uma cópia em local seguro: sem a CHAVE_CRIPTOGRAFIA os dados cifrados não podem ser lidos.
import { randomBytes } from 'node:crypto';

console.log(`CHAVE_CRIPTOGRAFIA=${randomBytes(32).toString('base64')}`);
console.log(`CHAVE_INDICE=${randomBytes(32).toString('base64')}`);
