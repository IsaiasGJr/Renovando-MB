/**
 * Entrada no painel pelo WhatsApp (como no site) e o painel de cada perfil:
 * pastor, semeador N1/N2 e parceiro. A equipe também pode entrar pelo WhatsApp (e-mail e senha continuam valendo).
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { registrar } from '../../../../compartilhado/src/auditoria.ts';
import { decifrar, indice } from '../../../../compartilhado/src/cripto.ts';
import { executar, PASTA_UPLOADS, um } from '../../../../compartilhado/src/db.ts';
import {
  cadastrarIgreja, cadastrarSemeador, montarPainel, novaIgrejaSchema, novoSemeadorSchema, ofertasRecentes, podeVerIgreja, whatsappSchema,
} from '../../../../compartilhado/src/painel.ts';
import { pdfPanfletoDaIgreja } from '../../../../compartilhado/src/panfleto.ts';
import { perfisDoWhatsapp } from '../../../../compartilhado/src/perfis.ts';
import { ehImagemValida, limitar, TIPOS_IMAGEM, zerarLimite } from '../../../../compartilhado/src/seguranca.ts';
import { ErroHttp, naoEncontrado, novoId, param, query, validar } from '../../../../compartilhado/src/util.ts';
import { enviarCodigoWhatsapp } from '../../../../compartilhado/src/whatsapp.ts';
import { assinar, assinarEscolha, assinarPerfil, exigirPerfil, lerEscolha } from '../auth.ts';
import { env } from '../env.ts';
import { conferirCodigoTotp } from '../totp.ts';
import { otimizarImagem } from './admin.ts';

const MIN = 60_000;
const resumo = (codigo: string) => createHash('sha256').update(`renovando-otp-painel:${codigo}`).digest('hex');
/** Código do painel fica separado do código do app (mesmo número, chaves diferentes). */
const chaveOtp = (idx: string) => `painel:${idx}`;

// ---------- Entrada pelo WhatsApp ----------

export const entrada = Router();

entrada.post('/entrar/whatsapp/codigo', async (req, res) => {
  const { whatsapp } = validar(z.object({ whatsapp: whatsappSchema }), req.body);
  limitar(`painel-codigo-ip:${req.ip}`, 10, 15 * MIN);
  limitar(`painel-codigo-fone:${whatsapp}`, 3, 15 * MIN, 'Já enviamos códigos para este número. Aguarde 15 minutos para pedir outro.');
  const idx = indice(whatsapp);
  const { perfis, situacoes } = perfisDoWhatsapp(idx);
  // Só envia para quem tem algum acesso. A resposta é a mesma nos dois casos (não revela quem tem acesso).
  if (perfis.length || situacoes.length) {
    const codigo = env.dev ? '123456' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!env.dev) await enviarCodigoWhatsapp(whatsapp, codigo);
    executar(
      `INSERT INTO otps (whatsapp, codigo, tentativas, expira_em) VALUES (?, ?, 0, ?)
       ON CONFLICT(whatsapp) DO UPDATE SET codigo = excluded.codigo, tentativas = 0, expira_em = excluded.expira_em`,
      chaveOtp(idx), resumo(codigo), new Date(Date.now() + 10 * MIN).toISOString(),
    );
    if (env.dev) console.log(`[otp painel] ${whatsapp}: ${codigo}`);
  }
  res.json({ ok: true });
});

entrada.post('/entrar/whatsapp/verificar', (req, res) => {
  const { whatsapp, codigo } = validar(z.object({ whatsapp: whatsappSchema, codigo: z.string().trim().length(6, 'o código tem 6 dígitos') }), req.body);
  limitar(`painel-verificar-ip:${req.ip}`, 20, 15 * MIN);
  const idx = indice(whatsapp);
  const otp = um<{ codigo: string; tentativas: number; expiraEm: string }>('SELECT * FROM otps WHERE whatsapp = ?', chaveOtp(idx));
  if (!otp || new Date(otp.expiraEm) < new Date()) throw new ErroHttp(400, 'Código expirado. Peça um novo.');
  if (otp.tentativas >= 5) throw new ErroHttp(429, 'Muitas tentativas. Peça um novo código.');
  const a = Buffer.from(otp.codigo);
  const b = Buffer.from(resumo(codigo));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    executar('UPDATE otps SET tentativas = tentativas + 1 WHERE whatsapp = ?', chaveOtp(idx));
    throw new ErroHttp(400, 'Código inválido. Confira e tente de novo.');
  }
  executar('DELETE FROM otps WHERE whatsapp = ?', chaveOtp(idx));
  const { perfis, situacoes } = perfisDoWhatsapp(idx);
  if (!perfis.length) {
    // Só tem cadastro em análise ou recusado: mostra a situação (como as telas "cadastro em revisão" do site).
    return void res.json({ perfis: [], situacoes });
  }
  res.json({
    escolha: assinarEscolha(idx),
    perfis: perfis.map((p) => ({ tipo: p.tipo, rotulo: p.rotulo, detalhe: p.detalhe, precisaTotp: !!p.precisaTotp })),
    situacoes,
  });
});

entrada.post('/entrar/perfil', (req, res) => {
  const d = validar(z.object({
    escolha: z.string(), tipo: z.enum(['equipe', 'pastor', 'semeador', 'parceiro']), codigoTotp: z.string().trim().optional(),
  }), req.body);
  const idx = lerEscolha(d.escolha);
  const perfil = perfisDoWhatsapp(idx).perfis.find((p) => p.tipo === d.tipo);
  if (!perfil) throw new ErroHttp(403, 'Este perfil não está disponível para este WhatsApp.');

  if (perfil.tipo === 'equipe') {
    const a = um<{ id: string; nome: string; email: string; papel: 'admin' | 'editor'; sessaoVersao: number; totpAtivo: number; totpSegredo: string; totpUltimoPasso: number }>(
      'SELECT * FROM admins WHERE id = ? AND ativo = 1', perfil.id,
    );
    if (!a) throw new ErroHttp(403, 'Acesso desativado.');
    // Quem tem verificação em duas etapas precisa do código do aplicativo também aqui.
    if (a.totpAtivo) {
      if (!d.codigoTotp) return void res.json({ precisaCodigo: true });
      limitar(`login-email:${a.email}`, 5, 15 * MIN, 'Muitas tentativas. Aguarde 15 minutos.');
      const passo = conferirCodigoTotp(decifrar(a.totpSegredo), d.codigoTotp.replace(/\D/g, ''), a.totpUltimoPasso);
      if (passo === null) {
        registrar({ admin: a, acao: 'login_2fa_falhou', recurso: 'sessao', resumo: `${a.email} (WhatsApp)`, ip: req.ip });
        throw new ErroHttp(401, 'Código de verificação incorreto ou vencido.');
      }
      executar('UPDATE admins SET totp_ultimo_passo = ? WHERE id = ?', passo, a.id);
      zerarLimite(`login-email:${a.email}`);
    }
    registrar({ admin: a, acao: 'login', recurso: 'sessao', resumo: 'pelo WhatsApp', ip: req.ip });
    return void res.json({
      tipo: 'equipe',
      token: assinar({ sub: a.id, papel: a.papel, v: a.sessaoVersao }),
      admin: { id: a.id, nome: a.nome, email: a.email, papel: a.papel, totpAtivo: !!a.totpAtivo },
      configurar2fa: env.doisFatoresObrigatorio && !a.totpAtivo,
    });
  }

  registrar({ autor: `${perfil.rotulo}: ${perfil.detalhe}`, acao: 'login', recurso: 'sessao', resumo: `Painel do ${perfil.rotulo.toLowerCase()} (WhatsApp)`, ip: req.ip });
  res.json({
    tipo: 'perfil',
    token: assinarPerfil({ sub: idx, perfil: perfil.tipo, id: perfil.id }),
    perfil: { tipo: perfil.tipo, rotulo: perfil.rotulo, nome: perfil.detalhe },
  });
});

// ---------- Painel dos perfis ----------

export const perfil = Router();
perfil.use(exigirPerfil);

perfil.get('/me', (req, res) => {
  const p = req.perfil!;
  res.json({ tipo: p.tipo, rotulo: p.rotulo, nome: p.nome });
});

/** Só o que é do perfil escolhido (o pastor não vê o painel de semeador da mesma pessoa, e vice-versa). */
perfil.get('/painel', (req, res) => {
  const p = req.perfil!;
  const tudo = montarPainel(p.indice);
  // Endereço público da API: os links de convite e o QR Code apontam para lá.
  const urlPublica = env.urlPublicaApi;
  if (p.tipo === 'pastor') {
    const ativas = tudo.igrejas.filter((i) => i.status === 'ativa');
    return void res.json({ igrejas: tudo.igrejas, ofertas: ofertasRecentes(ativas.map((i) => i.id)), percentuais: tudo.percentuais, urlPublica });
  }
  if (p.tipo === 'semeador') {
    const ids = (tudo.semeador?.igrejas ?? []).filter((i) => i.status === 'ativa').map((i) => i.id);
    return void res.json({ semeador: tudo.semeador, ofertas: ofertasRecentes(ids), percentuais: tudo.percentuais, urlPublica });
  }
  res.json({ parceiro: tudo.parceiro, urlPublica });
});

perfil.get('/igrejas/:id/panfleto', async (req, res) => {
  const p = req.perfil!;
  const id = param(req, 'id');
  if (p.tipo === 'parceiro' || !podeVerIgreja(p.indice, id)) throw naoEncontrado('Igreja');
  limitar(`panfleto-perfil:${p.indice}`, 30, 15 * MIN);
  const { pdf, nomeArquivo } = await pdfPanfletoDaIgreja(id, query(req, 'porPagina') === '6' ? 6 : 1, env.urlPublicaApi);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.send(pdf);
});

// Semeador cadastra igreja (fica ligada a ele, pendente de aprovação da equipe).
perfil.post('/igrejas', (req, res) => {
  const p = req.perfil!;
  if (p.tipo !== 'semeador') throw new ErroHttp(403, 'Só semeadores cadastram igrejas por aqui.');
  limitar(`perfil-cadastro:${p.indice}`, 20, 60 * MIN);
  const r = cadastrarIgreja({ ...validar(novaIgrejaSchema, req.body), codigoSemeador: undefined }, p.id);
  registrar({ autor: `${p.rotulo}: ${p.nome}`, acao: 'criar', recurso: 'igrejas', registroId: r.id, resumo: 'Igreja cadastrada pelo semeador', ip: req.ip });
  res.status(201).json(r);
});

// Semeador N1 cadastra um N2 na rede dele (pendente de aprovação).
perfil.post('/semeadores', (req, res) => {
  const p = req.perfil!;
  if (p.tipo !== 'semeador' || p.rotulo !== 'Semeador N1') throw new ErroHttp(403, 'Só semeadores N1 cadastram semeadores N2.');
  limitar(`perfil-cadastro:${p.indice}`, 20, 60 * MIN);
  const r = cadastrarSemeador({ ...validar(novoSemeadorSchema, req.body), codigoIndicacao: undefined }, p.id);
  registrar({ autor: `${p.rotulo}: ${p.nome}`, acao: 'criar', recurso: 'semeadores', registroId: r.id, resumo: 'Semeador N2 cadastrado pelo N1', ip: req.ip });
  res.status(201).json(r);
});

// "Minha igreja": o pastor atualiza logo, mensagem e endereço (nunca a chave PIX nem o status).
const igrejaDoPastor = (idx: string, id: string) =>
  um<{ id: string; nomeFantasia: string; logoUrl: string; descricao: string; endereco: string; cep: string; cidade: string; uf: string; slug: string; status: string }>(
    'SELECT id, nome_fantasia, logo_url, descricao, endereco, cep, cidade, uf, slug, status FROM igrejas WHERE id = ? AND pastor_whatsapp_indice = ?', id, idx,
  );

perfil.get('/minha-igreja/:id', (req, res) => {
  const p = req.perfil!;
  const i = p.tipo === 'pastor' ? igrejaDoPastor(p.indice, param(req, 'id')) : undefined;
  if (!i) throw naoEncontrado('Igreja');
  res.json(i);
});

perfil.put('/minha-igreja/:id', (req, res) => {
  const p = req.perfil!;
  const id = param(req, 'id');
  const antes = p.tipo === 'pastor' ? igrejaDoPastor(p.indice, id) : undefined;
  if (!antes) throw naoEncontrado('Igreja');
  const d = validar(z.object({
    logoUrl: z.string().regex(/^(\/uploads\/[\w-]+\.(png|jpg|webp|gif))?$/, 'envie a logo pelo botão').optional(),
    descricao: z.string().trim().max(600).optional(),
    endereco: z.string().trim().max(200).optional(),
    cep: z.string().trim().max(10).optional(),
  }), req.body);
  const campos = Object.entries(d).filter(([, v]) => v !== undefined);
  if (campos.length) {
    executar(`UPDATE igrejas SET ${campos.map(([k]) => `${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} = ?`).join(', ')} WHERE id = ?`, ...campos.map(([, v]) => String(v)), id);
    registrar({ autor: `Pastor: ${p.nome}`, acao: 'editar', recurso: 'igrejas', registroId: id, resumo: antes.nomeFantasia, detalhes: Object.fromEntries(campos), ip: req.ip });
  }
  res.json(igrejaDoPastor(p.indice, id));
});

// Envio da logo da igreja pelo pastor (só imagens, reduzidas e sem metadados).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) => cb(null, f.mimetype in TIPOS_IMAGEM),
});
perfil.post('/upload', upload.single('arquivo'), async (req, res) => {
  const p = req.perfil!;
  if (p.tipo !== 'pastor') throw new ErroHttp(403, 'Envio de imagem só para o pastor (logo da igreja).');
  limitar(`perfil-upload:${p.indice}`, 10, 60 * MIN);
  if (!req.file || !ehImagemValida(req.file.buffer.subarray(0, 12))) throw new ErroHttp(400, 'Envie uma imagem PNG, JPG, WEBP ou GIF.');
  let otimizada: Buffer;
  try {
    otimizada = await otimizarImagem(req.file.buffer);
  } catch {
    throw new ErroHttp(400, 'Não foi possível ler esta imagem. Tente outra.');
  }
  const nome = `${novoId()}.webp`;
  await writeFile(join(PASTA_UPLOADS, nome), otimizada);
  registrar({ autor: `Pastor: ${p.nome}`, acao: 'criar', recurso: 'upload', resumo: nome, ip: req.ip });
  res.status(201).json({ url: `/uploads/${nome}` });
});
