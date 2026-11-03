/**
 * PIX direto no banco, pela API Pix padrão do Banco Central (cobrança imediata "cob").
 * Bancos prontos:
 *   inter  Banco Inter (conta PJ)  https://developers.inter.co/references/pix
 *   efi    Efí (Gerencianet)       https://dev.efipay.com.br/docs/api-pix
 *
 * A cobrança PIX não exige CPF nem e-mail de quem paga (combina com as ofertas anônimas e com o
 * cadastro só por WhatsApp). Toda chamada usa o certificado da conta (mTLS), como os bancos exigem.
 *
 * .env da API (troque PREFIXO por INTER ou EFI):
 *   PIX_PROVEDOR=inter | efi
 *   PREFIXO_CLIENT_ID, PREFIXO_CLIENT_SECRET   credenciais da integração/aplicação
 *   PREFIXO_CHAVE_PIX                          chave PIX da conta que recebe as ofertas
 *   PREFIXO_HOMOLOGACAO=1                      usa o ambiente de testes (sandbox) do banco
 *   Inter: INTER_CERTIFICADO=/caminho/cert.crt, INTER_CHAVE_PRIVADA=/caminho/cert.key, INTER_CONTA (só se tiver várias contas)
 *   Efí:   EFI_CERTIFICADO=/caminho/cert.p12 (e EFI_CERTIFICADO_SENHA, se tiver)
 *   WEBHOOK_SEGREDO                            vai no endereço do aviso de pagamento
 *
 * Segurança do aviso de pagamento: além de conferir o segredo do endereço, o sistema CONSULTA a cobrança
 * no banco e só confirma a oferta se ela estiver CONCLUIDA. Um aviso falso nunca libera cupons.
 */
import { readFileSync } from 'node:fs';
import { request as httpsRequest, Agent } from 'node:https';
import { request as httpRequest } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ErroHttp } from './util.ts';
import type { ProvedorPix } from './pagamentos.ts';

type Resposta<T> = { status: number; dados: T };
type Config = { url: string; clientId: string; clientSecret: string; chave: string; agente?: Agent; conta?: string };

type Banco = {
  nome: 'inter' | 'efi';
  rotulo: string;
  prefixo: 'INTER' | 'EFI';
  producao: string;
  homologacao: string;
  /** Onde ficam /cob e /webhook. */
  caminhoPix: string;
  /** Variáveis de certificado obrigatórias (fora dos testes). */
  certificados: string[];
  agente(e: NodeJS.ProcessEnv): Agent | undefined;
  pedirToken(c: Config, chamar: Chamar): Promise<Resposta<{ access_token?: string; expires_in?: number }>>;
  /** Endereço cadastrado no banco para o aviso de pagamento. */
  urlAviso(urlApi: string, segredo: string): string;
  cabecalhosAviso: Record<string, string>;
};
type Chamar = <T>(metodo: string, caminho: string, corpo: unknown, cabecalhos: Record<string, string>, formulario?: boolean) => Promise<Resposta<T>>;

const ESCOPOS = 'cob.write cob.read webhook.write webhook.read';

const BANCOS: Record<Banco['nome'], Banco> = {
  inter: {
    nome: 'inter', rotulo: 'Banco Inter', prefixo: 'INTER',
    producao: 'https://cdpj.partners.bancointer.com.br', homologacao: 'https://cdpj-sandbox.partners.uatinter.co',
    caminhoPix: '/pix/v2', certificados: ['INTER_CERTIFICADO', 'INTER_CHAVE_PRIVADA'],
    agente: (e) => e.INTER_CERTIFICADO ? new Agent({ cert: readFileSync(e.INTER_CERTIFICADO), key: readFileSync(e.INTER_CHAVE_PRIVADA!), keepAlive: true }) : undefined,
    // Inter: formulário com as credenciais e os escopos (no máximo 5 tokens por minuto: por isso o token é guardado).
    pedirToken: (c, chamar) => chamar('POST', '/oauth/v2/token', { client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'client_credentials', scope: ESCOPOS }, {}, true),
    // O Inter acrescenta "/pix" ao endereço cadastrado: o aviso chega em /api/webhooks/pix/<segredo>/pix.
    urlAviso: (urlApi, segredo) => `${urlApi}/api/webhooks/pix/${encodeURIComponent(segredo)}`,
    cabecalhosAviso: {},
  },
  efi: {
    nome: 'efi', rotulo: 'Efí', prefixo: 'EFI',
    producao: 'https://pix.api.efipay.com.br', homologacao: 'https://pix-h.api.efipay.com.br',
    caminhoPix: '/v2', certificados: ['EFI_CERTIFICADO'],
    agente: (e) => e.EFI_CERTIFICADO ? new Agent({ pfx: readFileSync(e.EFI_CERTIFICADO), passphrase: e.EFI_CERTIFICADO_SENHA ?? '', keepAlive: true }) : undefined,
    pedirToken: (c, chamar) => chamar('POST', '/oauth/token', { grant_type: 'client_credentials' },
      { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}` }),
    // "ignorar=" evita o "/pix" no fim; "x-skip-mtls-checking" dispensa o mTLS no nosso servidor
    // (a segurança real é a consulta da cobrança, ver lerAviso).
    urlAviso: (urlApi, segredo) => `${urlApi}/api/webhooks/pix/${encodeURIComponent(segredo)}?ignorar=`,
    cabecalhosAviso: { 'x-skip-mtls-checking': 'true' },
  },
};

type Cob = { txid: string; status: string; pixCopiaECola?: string; valor?: { original: string } };

function criarCliente(banco: Banco) {
  let config: Config | null = null;
  let token: { valor: string; venceEm: number } | null = null;

  const lerConfig = (): Config => {
    if (config) return config;
    const e = process.env;
    const p = banco.prefixo;
    const faltando = [`${p}_CLIENT_ID`, `${p}_CLIENT_SECRET`, `${p}_CHAVE_PIX`].filter((k) => !e[k]);
    // PREFIXO_URL só existe para os testes automáticos (servidor falso local, sem certificado).
    const urlTeste = e[`${p}_URL`];
    if (!urlTeste) faltando.push(...banco.certificados.filter((k) => !e[k]));
    if (faltando.length) throw new Error(`PIX (${banco.rotulo}): falta configurar ${faltando.join(', ')} no .env da API.`);
    config = {
      url: urlTeste ?? (e[`${p}_HOMOLOGACAO`] === '1' ? banco.homologacao : banco.producao),
      clientId: e[`${p}_CLIENT_ID`]!, clientSecret: e[`${p}_CLIENT_SECRET`]!, chave: e[`${p}_CHAVE_PIX`]!,
      agente: urlTeste ? undefined : banco.agente(e), conta: e[`${p}_CONTA`],
    };
    return config;
  };

  const chamar: Chamar = (metodo, caminho, corpo, cabecalhos, formulario = false) => {
    const c = lerConfig();
    const alvo = new URL(caminho, c.url);
    const texto = corpo === undefined ? undefined
      : formulario ? new URLSearchParams(corpo as Record<string, string>).toString() : JSON.stringify(corpo);
    const fazer = alvo.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((ok, falha) => {
      const req = fazer(alvo, {
        method: metodo, agent: alvo.protocol === 'https:' ? c.agente : undefined, timeout: 20_000,
        headers: {
          'Content-Type': formulario ? 'application/x-www-form-urlencoded' : 'application/json',
          ...(texto ? { 'Content-Length': Buffer.byteLength(texto) } : {}),
          ...(c.conta ? { 'x-conta-corrente': c.conta } : {}),
          ...cabecalhos,
        },
      }, (res) => {
        let bruto = '';
        res.setEncoding('utf8');
        res.on('data', (p) => (bruto += p));
        res.on('end', () => {
          let dados: unknown = bruto;
          try { dados = bruto ? JSON.parse(bruto) : {}; } catch { /* resposta sem JSON */ }
          ok({ status: res.statusCode ?? 0, dados: dados as never });
        });
      });
      req.on('timeout', () => req.destroy(new Error(`${banco.rotulo} demorou para responder.`)));
      req.on('error', falha);
      if (texto) req.write(texto);
      req.end();
    });
  };

  // O token vale 1 hora: guarda e renova um pouco antes de vencer.
  const tokenDeAcesso = async () => {
    if (token && token.venceEm > Date.now()) return token.valor;
    const r = await banco.pedirToken(lerConfig(), chamar);
    if (r.status !== 200 || !r.dados.access_token) throw new Error(`${banco.rotulo} recusou as credenciais (HTTP ${r.status}).`);
    token = { valor: r.dados.access_token, venceEm: Date.now() + ((r.dados.expires_in ?? 3600) - 120) * 1000 };
    return token.valor;
  };

  const api = async <T>(metodo: string, caminho: string, corpo?: unknown, extras: Record<string, string> = {}) => {
    const r = await chamar<T>(metodo, `${banco.caminhoPix}${caminho}`, corpo, { Authorization: `Bearer ${await tokenDeAcesso()}`, ...extras });
    if (r.status === 401) token = null; // token revogado: o próximo pedido pega outro
    return r;
  };

  const provedor: ProvedorPix = {
    nome: banco.nome,
    async criarCobranca(c) {
      const r = await api<Cob>('PUT', `/cob/${c.txid}`, {
        calendario: { expiracao: c.expiraEmMin * 60 },
        valor: { original: c.valor.toFixed(2) },
        chave: lerConfig().chave,
        solicitacaoPagador: c.descricao.slice(0, 140),
      });
      if ((r.status !== 201 && r.status !== 200) || !r.dados.pixCopiaECola) {
        console.error(`[pix ${banco.nome}] falha ao criar cobrança`, r.status, JSON.stringify(r.dados).slice(0, 300));
        throw new ErroHttp(502, 'Não foi possível gerar o PIX agora. Tente de novo em instantes.');
      }
      return { copiaECola: r.dados.pixCopiaECola, idNoGateway: r.dados.txid };
    },
    async lerWebhook(req) {
      if (!segredoConfere(req)) throw new ErroHttp(401, 'Assinatura inválida.');
      // Padrão do Banco Central: { pix: [...] }. O Inter também documenta a lista direta: [...].
      const corpo = req.body as { pix?: unknown } | unknown[];
      const itens = Array.isArray(corpo) ? corpo : (corpo as { pix?: unknown })?.pix;
      if (!Array.isArray(itens)) return []; // aviso de teste do banco (ao cadastrar o endereço)
      const pagos: { txid: string }[] = [];
      for (const item of itens as { txid?: unknown }[]) {
        if (typeof item?.txid !== 'string' || !/^[a-zA-Z0-9]{26,35}$/.test(item.txid)) continue;
        // Não confia no aviso: pergunta ao banco se a cobrança foi mesmo paga.
        const r = await api<Cob>('GET', `/cob/${item.txid}`);
        if (r.status === 200 && r.dados.status === 'CONCLUIDA') pagos.push({ txid: item.txid });
      }
      return pagos;
    },
  };

  return {
    provedor,
    conferir: () => void lerConfig(),
    async cadastrarAviso(urlApi: string) {
      const segredo = process.env.WEBHOOK_SEGREDO ?? '';
      if (segredo.length < 24) throw new Error('Defina WEBHOOK_SEGREDO (24+ caracteres) no .env da API.');
      const webhookUrl = banco.urlAviso(urlApi.replace(/\/$/, ''), segredo);
      const r = await api('PUT', `/webhook/${encodeURIComponent(lerConfig().chave)}`, { webhookUrl }, banco.cabecalhosAviso);
      return { status: r.status, dados: r.dados, webhookUrl: webhookUrl.replace(encodeURIComponent(segredo), '***') };
    },
    reiniciar: () => ((config = null), (token = null)),
  };
}

/** Confere o segredo do aviso (no endereço /webhooks/pix/<segredo> ou em ?segredo=) sem vazar tempo de comparação. */
function segredoConfere(req: Request) {
  const esperado = Buffer.from(process.env.WEBHOOK_SEGREDO ?? '');
  const recebido = Buffer.from(String(req.params?.segredo ?? req.query?.segredo ?? ''));
  return esperado.length >= 24 && recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

const clientes = { inter: criarCliente(BANCOS.inter), efi: criarCliente(BANCOS.efi) };
export const inter = clientes.inter.provedor;
export const efi = clientes.efi.provedor;

const banco = (nome: string) => {
  const c = clientes[nome as keyof typeof clientes];
  if (!c) throw new Error(`PIX_PROVEDOR="${nome}" não é um banco com API Pix pronto (use inter ou efi).`);
  return c;
};
/** Confere a configuração ao iniciar a API (erro claro antes da primeira oferta, não durante). */
export const conferirConfigPix = (nome: string) => banco(nome).conferir();
/** Cadastra no banco o endereço do aviso de pagamento (rodar uma vez: npm run pix-webhook -w renovando-api). */
export const cadastrarAvisoPix = (nome: string, urlApi: string) => banco(nome).cadastrarAviso(urlApi);
/** Só para os testes: esquece a configuração e os tokens guardados. */
export const _reiniciarPix = () => Object.values(clientes).forEach((c) => c.reiniciar());
