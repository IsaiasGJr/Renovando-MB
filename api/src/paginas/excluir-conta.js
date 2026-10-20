// Página pública de exclusão de conta. Usa só a API deste mesmo endereço.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fone = '';

  function digitos(s) { return s.replace(/\D/g, ''); }
  function mascara(s) {
    var d = digitos(s).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function mostrar(texto, tipo) {
    var m = $('mensagem');
    m.className = tipo || 'erro';
    m.textContent = texto;
    m.hidden = !texto;
  }

  function enviar(caminho, corpo) {
    return fetch('/api' + caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.erro || 'Algo deu errado. Tente de novo.');
        return d;
      });
    }, function () {
      throw new Error('Sem conexão. Verifique sua internet e tente de novo.');
    });
  }

  // Dica do código fixo só aparece quando o servidor está em modo de teste.
  fetch('/api/saude').then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.modoTeste) $('dica-teste').hidden = false;
  }).catch(function () {});

  $('fone').addEventListener('input', function (e) { e.target.value = mascara(e.target.value); });

  function atualizarBotao() {
    $('btn-excluir').disabled = !(digitos($('codigo').value).length === 6 && $('confirmacao').value.trim().toUpperCase() === 'EXCLUIR');
  }
  $('codigo').addEventListener('input', function (e) { e.target.value = digitos(e.target.value).slice(0, 6); atualizarBotao(); });
  $('confirmacao').addEventListener('input', atualizarBotao);

  $('form-fone').addEventListener('submit', function (e) {
    e.preventDefault();
    mostrar('');
    fone = digitos($('fone').value);
    if (fone.length !== 11) return mostrar('Informe o WhatsApp com DDD, 11 dígitos.');
    var botao = $('btn-codigo');
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    enviar('/auth/codigo', { whatsapp: fone }).then(function () {
      $('enviado-para').textContent = 'Enviamos um código para ' + mascara(fone) + '.';
      $('form-fone').hidden = true;
      $('form-excluir').hidden = false;
      $('codigo').focus();
    }).catch(function (err) {
      mostrar(err.message);
    }).then(function () {
      botao.disabled = false;
      botao.textContent = 'Receber código no WhatsApp';
    });
  });

  $('form-excluir').addEventListener('submit', function (e) {
    e.preventDefault();
    mostrar('');
    var botao = $('btn-excluir');
    botao.disabled = true;
    botao.textContent = 'Excluindo…';
    enviar('/conta/excluir', {
      whatsapp: fone,
      codigo: digitos($('codigo').value),
      confirmacao: $('confirmacao').value.trim().toUpperCase(),
    }).then(function () {
      $('form-excluir').hidden = true;
      $('concluido').hidden = false;
      $('concluido').scrollIntoView({ behavior: 'smooth' });
    }).catch(function (err) {
      mostrar(err.message);
      botao.textContent = 'Excluir minha conta';
      atualizarBotao();
    });
  });

  $('btn-trocar').addEventListener('click', function () {
    mostrar('');
    $('form-excluir').hidden = true;
    $('form-fone').hidden = false;
    $('codigo').value = '';
    $('confirmacao').value = '';
    atualizarBotao();
    $('fone').focus();
  });
})();
