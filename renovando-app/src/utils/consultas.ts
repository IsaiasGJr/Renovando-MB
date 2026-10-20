import { soDigitos } from './format';

/** Endereço pelo CEP (ViaCEP, pública e gratuita). */
export async function buscarCep(cep: string) {
  const r = await fetch(`https://viacep.com.br/ws/${soDigitos(cep)}/json/`);
  const d = await r.json();
  if (!r.ok || d.erro) throw new Error('CEP não encontrado.');
  return {
    endereco: [d.logradouro, d.bairro].filter(Boolean).join(', '),
    cidade: d.localidade as string,
    uf: d.uf as string,
  };
}

/** Dados da empresa pelo CNPJ (BrasilAPI, pública e gratuita). */
export async function buscarCnpj(cnpj: string) {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${soDigitos(cnpj)}`);
  if (!r.ok) throw new Error('CNPJ não encontrado.');
  const d = await r.json();
  return {
    razaoSocial: (d.razao_social ?? '') as string,
    nomeFantasia: (d.nome_fantasia || d.razao_social || '') as string,
    cep: String(d.cep ?? ''),
    endereco: [d.logradouro, d.numero, d.bairro].filter(Boolean).join(', '),
    cidade: (d.municipio ?? '') as string,
    uf: (d.uf ?? '') as string,
  };
}
