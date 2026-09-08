/**
 * Previa da resposta de um comando.
 *
 * Reimplementa o `render()` do @ndev/core de forma proposital: e uma
 * aproximacao visual rodando no browser, com valores de exemplo. A fonte da
 * verdade continua sendo o motor no servidor - por isso a previa mostra
 * "como vai ficar", nunca decide nada.
 */
export function previewResponse(template: string, options: { user?: string; channel?: string } = {}) {
  const user = options.user ?? 'Você';
  const channel = options.channel ?? 'seu canal';

  return template
    .replace(/\{random:([^}]*)\}/gi, (_m, list: string) => {
      const opts = list.split('|').map((o) => o.trim()).filter(Boolean);
      return opts[0] ?? '';
    })
    .replace(/\{arg(\d+)\}/gi, (_m, n: string) => `arg${n}`)
    .replace(/\{user\}/gi, user)
    .replace(/\{mention\}/gi, `@${user}`)
    .replace(/\{target\}/gi, 'alguém')
    .replace(/\{channel\}/gi, channel)
    .replace(/\{server\}/gi, channel)
    .replace(/\{args\}/gi, 'os argumentos')
    .replace(/\{count\}/gi, '42')
    .replace(/\{uptime\}/gi, '3h 12m 5s')
    .replace(/\{platform\}/gi, 'Discord');
}
